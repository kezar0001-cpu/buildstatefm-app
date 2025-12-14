const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================
// PROPERTY CONTROLLER (LEGACY - DEPRECATED)
// ============================================
// NOTE: This controller is legacy code and is NO LONGER USED in production.
// The active implementation is in backend/src/routes/properties.js
// This file is kept for backward compatibility with older tests only.
// ============================================

/**
 * Get all properties for the authenticated user, filtered by their role.
 */
exports.getProperties = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    let whereClause = {};

    // Determine the properties to show based on the user's role
    if (role === 'PROPERTY_MANAGER') {
      whereClause = { managerId: userId };
    } else if (role === 'OWNER') {
      whereClause = { owners: { some: { ownerId: userId } } };
    } else if (role === 'TENANT') {
      const tenantUnits = await prisma.unitTenant.findMany({
        where: { tenantId: userId, isActive: true },
        select: { unit: { select: { propertyId: true } } },
      });
      const propertyIds = [...new Set(tenantUnits.map(ut => ut.unit.propertyId))];
      whereClause = { id: { in: propertyIds } };
    } else {
      // For other roles like TECHNICIAN or if no specific filter applies,
      // you might want to return an empty list or handle as per your business logic.
      return res.json([]);
    }

    const properties = await prisma.property.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { units: true, jobs: true, inspections: true },
        },
        units: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add occupancy statistics to each property
    const propertiesWithOccupancy = properties.map(property => {
      const occupiedCount = property.units.filter(u => u.status === 'OCCUPIED').length;
      const vacantCount = property.units.filter(u => u.status === 'VACANT').length;
      const maintenanceCount = property.units.filter(u => u.status === 'MAINTENANCE').length;
      const totalUnits = property.units.length || property.totalUnits || 0;
      const occupancyRate = totalUnits > 0 ? ((occupiedCount / totalUnits) * 100).toFixed(1) : 0;

      return {
        ...property,
        occupancyStats: {
          occupied: occupiedCount,
          vacant: vacantCount,
          maintenance: maintenanceCount,
          total: totalUnits,
          occupancyRate: parseFloat(occupancyRate),
        },
        // Remove the units array from response to keep payload lean
        units: undefined,
      };
    });

    res.json(propertiesWithOccupancy);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
};

/**
 * Get a single property by ID
 */
exports.getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        units: {
          include: {
            tenants: {
              where: { isActive: true },
              include: {
                tenant: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
          orderBy: { unitNumber: 'asc' },
        },
        owners: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: {
            jobs: true,
            inspections: true,
            plans: true,
            serviceRequests: true,
          },
        },
      },
    });
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Check access permissions
    const hasAccess = await checkPropertyAccess(userId, role, property.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
};

/**
 * Create a new property (Property Manager only)
 */
exports.createProperty = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can create properties' });
    }
    
    // Check if user has active subscription
    const hasSubscription = await checkActiveSubscription(userId);
    if (!hasSubscription) {
      return res.status(403).json({ 
        error: 'Active subscription required to create properties',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }
    
    const {
      name,
      address,
      city,
      state,
      zipCode,
      country,
      propertyType,
      yearBuilt,
      totalUnits = 0,
      totalArea,
      description,
      imageUrl,
    } = req.body;

    const trimmedName = name?.trim();
    const trimmedAddress = address?.trim();
    const trimmedCity = city?.trim();
    const trimmedState = state?.trim() || null;
    const trimmedZip = zipCode?.trim() || null;
    const trimmedCountry = country?.trim();
    const trimmedPropertyType = propertyType?.trim();

    // Validation
    if (!trimmedName || !trimmedAddress || !trimmedCity || !trimmedCountry || !trimmedPropertyType) {
      return res.status(400).json({
        error: 'Missing required fields: name, address, city, country, propertyType'
      });
    }

    const normalisedTotalUnits =
      totalUnits === undefined || totalUnits === null || totalUnits === ''
        ? 0
        : parseInt(totalUnits, 10);
    const normalisedTotalArea =
      totalArea === undefined || totalArea === null || totalArea === ''
        ? null
        : parseFloat(totalArea);

    const property = await prisma.property.create({
      data: {
        name: trimmedName,
        address: trimmedAddress,
        city: trimmedCity,
        state: trimmedState,
        zipCode: trimmedZip,
        country: trimmedCountry,
        propertyType: trimmedPropertyType,
        yearBuilt: yearBuilt ? parseInt(yearBuilt, 10) : null,
        totalUnits: Number.isNaN(normalisedTotalUnits) ? 0 : normalisedTotalUnits,
        totalArea: Number.isNaN(normalisedTotalArea) ? null : normalisedTotalArea,
        description,
        imageUrl,
        managerId: userId,
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    
    res.status(201).json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
};

/**
 * Update a property (Property Manager only)
 */
exports.updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can update properties' });
    }
    
    // Check if property belongs to this manager
    const existingProperty = await prisma.property.findUnique({
      where: { id },
    });
    
    if (!existingProperty) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    if (existingProperty.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const {
      name,
      address,
      city,
      state,
      zipCode,
      country,
      propertyType,
      yearBuilt,
      totalUnits,
      totalArea,
      status,
      description,
      imageUrl,
    } = req.body;

    const trimmedName = name !== undefined ? name?.trim() : undefined;
    const trimmedAddress = address !== undefined ? address?.trim() : undefined;
    const trimmedCity = city !== undefined ? city?.trim() : undefined;
    const trimmedState = state !== undefined ? state?.trim() || null : undefined;
    const trimmedZip = zipCode !== undefined ? zipCode?.trim() || null : undefined;
    const trimmedCountry = country !== undefined ? country?.trim() : undefined;
    const trimmedPropertyType = propertyType !== undefined ? propertyType?.trim() : undefined;
    const normalisedYearBuilt =
      yearBuilt !== undefined ? (yearBuilt ? parseInt(yearBuilt, 10) : null) : undefined;
    const normalisedTotalUnits =
      totalUnits !== undefined
        ? totalUnits === null || totalUnits === ''
          ? 0
          : (() => {
              const parsed = parseInt(totalUnits, 10);
              return Number.isNaN(parsed) ? existingProperty.totalUnits : parsed;
            })()
        : undefined;
    const normalisedTotalArea =
      totalArea !== undefined
        ? totalArea === null || totalArea === ''
          ? null
          : (() => {
              const parsed = parseFloat(totalArea);
              return Number.isNaN(parsed) ? existingProperty.totalArea : parsed;
            })()
        : undefined;

    const trimmedDescription =
      description !== undefined ? description?.trim() || null : undefined;
    const trimmedImageUrl = imageUrl !== undefined ? imageUrl?.trim() || null : undefined;

    const property = await prisma.property.update({
      where: { id },
      data: {
        ...(trimmedName !== undefined && { name: trimmedName }),
        ...(trimmedAddress !== undefined && { address: trimmedAddress }),
        ...(trimmedCity !== undefined && { city: trimmedCity }),
        ...(trimmedState !== undefined && { state: trimmedState }),
        ...(trimmedZip !== undefined && { zipCode: trimmedZip }),
        ...(trimmedCountry !== undefined && { country: trimmedCountry }),
        ...(trimmedPropertyType !== undefined && { propertyType: trimmedPropertyType }),
        ...(normalisedYearBuilt !== undefined && { yearBuilt: normalisedYearBuilt }),
        ...(normalisedTotalUnits !== undefined && { totalUnits: normalisedTotalUnits }),
        ...(normalisedTotalArea !== undefined && { totalArea: normalisedTotalArea }),
        ...(status && { status }),
        ...(trimmedDescription !== undefined && { description: trimmedDescription }),
        ...(trimmedImageUrl !== undefined && { imageUrl: trimmedImageUrl }),
      },
      include: {
        units: {
          select: {
            id: true,
            unitNumber: true,
            status: true,
          },
        },
        owners: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            units: true,
            jobs: true,
            inspections: true,
          },
        },
      },
    });
    
    res.json(property);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
};

/**
 * Delete a property (Property Manager only)
 */
exports.deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can delete properties' });
    }
    
    // Check if property belongs to this manager
    const existingProperty = await prisma.property.findUnique({
      where: { id },
      include: {
        units: true,
      },
    });
    
    if (!existingProperty) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    if (existingProperty.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if property has units with active tenants
    const hasActiveTenants = await prisma.unitTenant.findFirst({
      where: {
        unit: {
          propertyId: id,
        },
        isActive: true,
      },
    });
    
    if (hasActiveTenants) {
      return res.status(400).json({ 
        error: 'Cannot delete property with active tenants. Please remove tenants first.' 
      });
    }
    
    await prisma.property.delete({
      where: { id },
    });
    
    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
};

/**
 * Assign an owner to a property
 */
exports.assignOwner = async (req, res) => {
  try {
    const { id } = req.params; // property id
    const { ownerId, ownershipPercentage = 100 } = req.body;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can assign owners' });
    }
    
    // Check if property belongs to this manager
    const property = await prisma.property.findUnique({
      where: { id },
    });
    
    if (!property || property.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if owner exists and has OWNER role
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
    });
    
    if (!owner || owner.role !== 'OWNER') {
      return res.status(400).json({ error: 'Invalid owner' });
    }
    
    const propertyOwner = await prisma.propertyOwner.create({
      data: {
        propertyId: id,
        ownerId,
        ownershipPercentage: parseFloat(ownershipPercentage),
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    
    res.status(201).json(propertyOwner);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Owner already assigned to this property' });
    }
    console.error('Error assigning owner:', error);
    res.status(500).json({ error: 'Failed to assign owner' });
  }
};

/**
 * Remove an owner from a property
 */
exports.removeOwner = async (req, res) => {
  try {
    const { id, ownerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can remove owners' });
    }
    
    // Check if property belongs to this manager
    const property = await prisma.property.findUnique({
      where: { id },
    });
    
    if (!property || property.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await prisma.propertyOwner.delete({
      where: {
        propertyId_ownerId: {
          propertyId: id,
          ownerId: ownerId,
        },
      },
    });
    
    res.json({ message: 'Owner removed successfully' });
  } catch (error) {
    console.error('Error removing owner:', error);
    res.status(500).json({ error: 'Failed to remove owner' });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function checkPropertyAccess(userId, role, propertyId) {
  if (role === 'PROPERTY_MANAGER') {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, managerId: userId },
    });
    return !!property;
  }
  
  if (role === 'OWNER') {
    const ownership = await prisma.propertyOwner.findFirst({
      where: { propertyId, ownerId: userId },
    });
    return !!ownership;
  }
  
  if (role === 'TENANT') {
    const [unitTenant, propertyTenant] = await Promise.all([
      prisma.unitTenant.findFirst({
        where: {
          unit: { propertyId },
          tenantId: userId,
          isActive: true,
        },
        select: { id: true },
      }),
      prisma.propertyTenant.findFirst({
        where: {
          propertyId,
          tenantId: userId,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
    return Boolean(unitTenant || propertyTenant);
  }
  
  return false;
}

const TRIAL_PERIOD_DAYS = 14;

function calculateTrialEndDate(baseDate = new Date()) {
  const endDate = new Date(baseDate);
  endDate.setDate(endDate.getDate() + TRIAL_PERIOD_DAYS);
  return endDate;
}

async function checkActiveSubscription(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      trialEndDate: true,
      createdAt: true,
    },
  });

  if (!user) return false;

  if (user.subscriptionStatus === 'ACTIVE') {
    return true;
  }

  if (user.subscriptionStatus === 'TRIAL') {
    const now = new Date();
    let trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;

    if (!trialEndDate) {
      trialEndDate = calculateTrialEndDate(user.createdAt ? new Date(user.createdAt) : now);
      await prisma.user.update({
        where: { id: userId },
        data: { trialEndDate },
      });
    }

    if (trialEndDate > now) {
      return true;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'SUSPENDED', trialEndDate },
    });
    return false;
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      OR: [
        { endDate: null },
        { endDate: { gt: new Date() } },
      ],
    },
  });

  if (subscription) {
    if (user.subscriptionStatus !== 'ACTIVE') {
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionStatus: 'ACTIVE' },
      });
    }
    return true;
  }

  return false;
}
