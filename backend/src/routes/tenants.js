import { Router } from 'express';
import { prisma } from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = Router();

const PROPERTY_SELECT = {
  id: true,
  name: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  managerId: true,
  owners: {
    select: {
      ownerId: true,
    },
  },
};

function buildTenantUnitAccessFilter(user) {
  if (!user) return null;

  if (user.role === 'PROPERTY_MANAGER') {
    return {
      unit: {
        property: {
          managerId: user.id,
        },
      },
    };
  }

  if (user.role === 'OWNER') {
    return {
      unit: {
        property: {
          owners: {
            some: {
              ownerId: user.id,
            },
          },
        },
      },
    };
  }

  return null;
}

function buildTenantInclude(user) {
  const unitAccessFilter = buildTenantUnitAccessFilter(user);

  return {
    tenantProfile: true,
    tenantUnits: {
      ...(unitAccessFilter ? { where: unitAccessFilter } : {}),
      include: {
        unit: {
          include: {
            property: {
              select: PROPERTY_SELECT,
            },
          },
        },
      },
    },
  };
}

export function buildTenantAccessWhere(user) {
  if (!user) return null;

  if (user.role === 'PROPERTY_MANAGER') {
    return {
      role: 'TENANT',
      tenantUnits: {
        some: {
          unit: {
            property: {
              managerId: user.id,
            },
          },
        },
      },
    };
  }

  if (user.role === 'OWNER') {
    return {
      role: 'TENANT',
      tenantUnits: {
        some: {
          unit: {
            property: {
              owners: {
                some: {
                  ownerId: user.id,
                },
              },
            },
          },
        },
      },
    };
  }

  return null;
}

router.use(requireAuth);

// GET /api/tenants/my-units - Get units for current tenant user
router.get('/my-units', async (req, res) => {
  try {
    if (req.user.role !== 'TENANT') {
      return sendError(res, 403, 'Only tenants can access this endpoint', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const unitTenants = await prisma.unitTenant.findMany({
      where: {
        tenantId: req.user.id,
        isActive: true,
      },
      include: {
        unit: {
          include: {
            property: {
              select: PROPERTY_SELECT,
            },
          },
        },
      },
      orderBy: {
        leaseStart: 'desc',
      },
    });

    const units = unitTenants.map(ut => ({
      ...ut.unit,
      leaseStart: ut.leaseStart,
      leaseEnd: ut.leaseEnd,
      rentAmount: ut.rentAmount,
      depositAmount: ut.depositAmount,
    }));

    res.json({
      success: true,
      units,
    });
  } catch (error) {
    console.error('Get tenant units error:', error);
    return sendError(res, 500, 'Failed to fetch tenant units', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.use(requireRole('PROPERTY_MANAGER', 'OWNER'));

// GET /api/tenants - Get all tenants for accessible properties
router.get('/', async (req, res) => {
  try {
    const where = buildTenantAccessWhere(req.user);

    if (!where) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const tenants = await prisma.user.findMany({
      where,
      include: buildTenantInclude(req.user),
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      tenants,
    });
  } catch (error) {
    console.error('Get tenants error:', error);
    return sendError(res, 500, 'Failed to fetch tenants', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /api/tenants/:id - Get specific tenant with access control
router.get('/:id', async (req, res) => {
  try {
    const where = buildTenantAccessWhere(req.user);

    if (!where) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const tenant = await prisma.user.findFirst({
      where: {
        ...where,
        id: req.params.id,
      },
      include: buildTenantInclude(req.user),
    });

    if (!tenant) {
      return sendError(res, 404, 'Tenant not found', ErrorCodes.RES_TENANT_NOT_FOUND);
    }

    res.json({
      success: true,
      tenant,
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    return sendError(res, 500, 'Failed to fetch tenant', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
