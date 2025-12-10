const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================
// UNIT CONTROLLER
// ============================================

/**
 * Get all units for a property
 */
exports.getUnits = async (req, res) => {
  try {
    const { propertyId } = req.query;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }
    
    // Check access to property
    const hasAccess = await checkPropertyAccess(userId, role, propertyId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const units = await prisma.unit.findMany({
      where: { propertyId },
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
        _count: {
          select: {
            jobs: true,
            inspections: true,
          },
        },
      },
      orderBy: { unitNumber: 'asc' },
    });
    
    res.json(units);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
};

/**
 * Get a single unit by ID
 */
exports.getUnitById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            manager: {
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
        tenants: {
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
          orderBy: { isActive: 'desc' },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        inspections: {
          orderBy: { scheduledDate: 'desc' },
          take: 5,
        },
      },
    });
    
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    // Check access
    const hasAccess = await checkPropertyAccess(userId, role, unit.propertyId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(unit);
  } catch (error) {
    console.error('Error fetching unit:', error);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
};

/**
 * Create a new unit (Property Manager only)
 */
exports.createUnit = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can create units' });
    }
    
    const {
      propertyId,
      unitNumber,
      floor,
      bedrooms,
      bathrooms,
      area,
      rentAmount,
      status = 'AVAILABLE',
      description,
      imageUrl,
    } = req.body;
    
    if (!propertyId || !unitNumber) {
      return res.status(400).json({ error: 'Property ID and unit number are required' });
    }
    
    // Check if property belongs to this manager
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    
    if (!property || property.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check for duplicate unit number
    const existingUnit = await prisma.unit.findFirst({
      where: {
        propertyId,
        unitNumber,
      },
    });
    
    if (existingUnit) {
      return res.status(400).json({ error: 'Unit number already exists for this property' });
    }
    
    const unit = await prisma.unit.create({
      data: {
        propertyId,
        unitNumber,
        floor: floor ? parseInt(floor) : null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        area: area ? parseFloat(area) : null,
        rentAmount: rentAmount ? parseFloat(rentAmount) : null,
        status,
        description,
        imageUrl,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
    
    // Update property's total unit count
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        totalUnits: {
          increment: 1,
        },
      },
    });
    
    res.status(201).json(unit);
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ error: 'Failed to create unit' });
  }
};

/**
 * Update a unit (Property Manager only)
 */
exports.updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can update units' });
    }
    
    const existingUnit = await prisma.unit.findUnique({
      where: { id },
      include: { property: true },
    });
    
    if (!existingUnit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    if (existingUnit.property.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const {
      unitNumber,
      floor,
      bedrooms,
      bathrooms,
      area,
      rentAmount,
      status,
      description,
      imageUrl,
    } = req.body;
    
    // Check for duplicate unit number if changing
    if (unitNumber && unitNumber !== existingUnit.unitNumber) {
      const duplicate = await prisma.unit.findFirst({
        where: {
          propertyId: existingUnit.propertyId,
          unitNumber,
          NOT: { id },
        },
      });
      
      if (duplicate) {
        return res.status(400).json({ error: 'Unit number already exists for this property' });
      }
    }
    
    const unit = await prisma.unit.update({
      where: { id },
      data: {
        ...(unitNumber && { unitNumber }),
        ...(floor !== undefined && { floor: floor ? parseInt(floor) : null }),
        ...(bedrooms !== undefined && { bedrooms: bedrooms ? parseInt(bedrooms) : null }),
        ...(bathrooms !== undefined && { bathrooms: bathrooms ? parseFloat(bathrooms) : null }),
        ...(area !== undefined && { area: area ? parseFloat(area) : null }),
        ...(rentAmount !== undefined && { rentAmount: rentAmount ? parseFloat(rentAmount) : null }),
        ...(status && { status }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        tenants: {
          where: { isActive: true },
          include: {
            tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    
    res.json(unit);
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({ error: 'Failed to update unit' });
  }
};

/**
 * Delete a unit (Property Manager only)
 */
exports.deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can delete units' });
    }
    
    const existingUnit = await prisma.unit.findUnique({
      where: { id },
      include: { 
        property: true,
        tenants: {
          where: { isActive: true },
        },
      },
    });
    
    if (!existingUnit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    if (existingUnit.property.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (existingUnit.tenants.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete unit with active tenants. Please remove tenants first.' 
      });
    }
    
    await prisma.unit.delete({
      where: { id },
    });
    
    // Update property's total unit count
    await prisma.property.update({
      where: { id: existingUnit.propertyId },
      data: {
        totalUnits: {
          decrement: 1,
        },
      },
    });
    
    res.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({ error: 'Failed to delete unit' });
  }
};

/**
 * Assign a tenant to a unit
 */
exports.assignTenant = async (req, res) => {
  try {
    const { id } = req.params; // unit id
    const { tenantId, leaseStart, leaseEnd, rentAmount, depositAmount } = req.body;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can assign tenants' });
    }
    
    if (!tenantId || !leaseStart || !leaseEnd || !rentAmount) {
      return res.status(400).json({ 
        error: 'Tenant ID, lease start, lease end, and rent amount are required' 
      });
    }
    
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: { property: true },
    });
    
    if (!unit || unit.property.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if tenant exists and has TENANT role
    const tenant = await prisma.user.findUnique({
      where: { id: tenantId },
    });
    
    if (!tenant || tenant.role !== 'TENANT') {
      return res.status(400).json({ error: 'Invalid tenant' });
    }
    
    // Check if tenant is already assigned to this unit
    const existing = await prisma.unitTenant.findFirst({
      where: {
        unitId: id,
        tenantId,
        isActive: true,
      },
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Tenant is already assigned to this unit' });
    }
    
    const unitTenant = await prisma.unitTenant.create({
      data: {
        unitId: id,
        tenantId,
        leaseStart: new Date(leaseStart),
        leaseEnd: new Date(leaseEnd),
        rentAmount: parseFloat(rentAmount),
        depositAmount: depositAmount ? parseFloat(depositAmount) : null,
        isActive: true,
      },
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
    });
    
    // Update unit status to OCCUPIED
    await prisma.unit.update({
      where: { id },
      data: { status: 'OCCUPIED' },
    });
    
    res.status(201).json(unitTenant);
  } catch (error) {
    console.error('Error assigning tenant:', error);
    res.status(500).json({ error: 'Failed to assign tenant' });
  }
};

/**
 * Orchestrated move-in workflow
 * Handles tenant assignment, inspection creation, and unit status updates atomically
 */
exports.moveIn = async (req, res) => {
  try {
    const { id } = req.params; // unit id
    const { tenantId, email, leaseStart, leaseEnd, rentAmount, depositAmount, createInspection, inspectionDate } = req.body;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can process move-ins' });
    }
    
    // Validate required fields
    if (!leaseStart || !leaseEnd || !rentAmount) {
      return res.status(400).json({ 
        error: 'Lease start, lease end, and rent amount are required' 
      });
    }
    
    // Get unit and verify access
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: { property: true },
    });
    
    if (!unit || unit.property.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if unit is available
    const activeTenants = await prisma.unitTenant.count({
      where: { unitId: id, isActive: true },
    });
    
    if (activeTenants > 0) {
      return res.status(400).json({ error: 'Unit already has active tenants' });
    }
    
    let tenant;
    
    // If tenantId provided, use existing tenant
    if (tenantId) {
      tenant = await prisma.user.findUnique({
        where: { id: tenantId },
      });
      
      if (!tenant || tenant.role !== 'TENANT') {
        return res.status(400).json({ error: 'Invalid tenant' });
      }
    } 
    // If email provided, find or invite tenant
    else if (email) {
      tenant = await prisma.user.findUnique({
        where: { email },
      });
      
      if (!tenant) {
        // Create invitation for new tenant
        const invitation = await prisma.invitation.create({
          data: {
            email,
            role: 'TENANT',
            invitedBy: userId,
            status: 'PENDING',
          },
        });
        
        return res.status(202).json({
          message: 'Tenant invitation created. Move-in will complete when tenant accepts.',
          invitation,
          pendingMoveIn: {
            unitId: id,
            leaseStart,
            leaseEnd,
            rentAmount: parseFloat(rentAmount),
            depositAmount: depositAmount ? parseFloat(depositAmount) : null,
          },
        });
      }
      
      if (tenant.role !== 'TENANT') {
        return res.status(400).json({ error: 'User exists but is not a tenant' });
      }
    } else {
      return res.status(400).json({ error: 'Either tenantId or email must be provided' });
    }
    
    // Create tenant assignment
    const unitTenant = await prisma.unitTenant.create({
      data: {
        unitId: id,
        tenantId: tenant.id,
        leaseStart: new Date(leaseStart),
        leaseEnd: new Date(leaseEnd),
        rentAmount: parseFloat(rentAmount),
        depositAmount: depositAmount ? parseFloat(depositAmount) : null,
        isActive: true,
      },
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
    });
    
    // Update unit status to PENDING_MOVE_IN or OCCUPIED
    await prisma.unit.update({
      where: { id },
      data: { status: createInspection ? 'PENDING_MOVE_IN' : 'OCCUPIED' },
    });
    
    let inspection = null;
    
    // Create move-in inspection if requested
    if (createInspection && inspectionDate) {
      inspection = await prisma.inspection.create({
        data: {
          title: `Move-in Inspection - Unit ${unit.unitNumber}`,
          type: 'MOVE_IN',
          status: 'SCHEDULED',
          scheduledDate: new Date(inspectionDate),
          propertyId: unit.propertyId,
          unitId: id,
        },
      });
      
      // Notify tenant about inspection
      await prisma.notification.create({
        data: {
          userId: tenant.id,
          type: 'INSPECTION_SCHEDULED',
          title: 'Move-in Inspection Scheduled',
          message: `Your move-in inspection is scheduled for ${new Date(inspectionDate).toLocaleDateString()}`,
          entityType: 'inspection',
          entityId: inspection.id,
        },
      });
    }
    
    // Notify tenant about move-in
    await prisma.notification.create({
      data: {
        userId: tenant.id,
        type: 'SYSTEM',
        title: 'Welcome to Your New Home',
        message: `Your lease for Unit ${unit.unitNumber} begins on ${new Date(leaseStart).toLocaleDateString()}`,
        entityType: 'unit',
        entityId: id,
      },
    });
    
    res.status(201).json({
      success: true,
      unitTenant,
      inspection,
      unit: {
        ...unit,
        status: createInspection ? 'PENDING_MOVE_IN' : 'OCCUPIED',
      },
    });
  } catch (error) {
    console.error('Error processing move-in:', error);
    res.status(500).json({ error: 'Failed to process move-in' });
  }
};

/**
 * Orchestrated move-out workflow
 * Handles inspection creation, tenant deactivation, and unit status updates atomically
 */
exports.moveOut = async (req, res) => {
  try {
    const { id } = req.params; // unit id
    const { tenantId, moveOutDate, createInspection, inspectionDate, findings } = req.body;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can process move-outs' });
    }
    
    if (!tenantId || !moveOutDate) {
      return res.status(400).json({ error: 'Tenant ID and move-out date are required' });
    }
    
    // Get unit and verify access
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: { property: true },
    });
    
    if (!unit || unit.property.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Verify tenant is assigned to this unit
    const unitTenant = await prisma.unitTenant.findFirst({
      where: {
        unitId: id,
        tenantId,
        isActive: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    
    if (!unitTenant) {
      return res.status(404).json({ error: 'Active tenant assignment not found' });
    }
    
    let inspection = null;
    
    // Create move-out inspection if requested
    if (createInspection && inspectionDate) {
      inspection = await prisma.inspection.create({
        data: {
          title: `Move-out Inspection - Unit ${unit.unitNumber}`,
          type: 'MOVE_OUT',
          status: 'SCHEDULED',
          scheduledDate: new Date(inspectionDate),
          propertyId: unit.propertyId,
          unitId: id,
          findings: findings || null,
        },
      });
      
      // Update unit status to PENDING_MOVE_OUT
      await prisma.unit.update({
        where: { id },
        data: { status: 'PENDING_MOVE_OUT' },
      });
      
      // Notify tenant about inspection
      await prisma.notification.create({
        data: {
          userId: tenantId,
          type: 'INSPECTION_SCHEDULED',
          title: 'Move-out Inspection Scheduled',
          message: `Your move-out inspection is scheduled for ${new Date(inspectionDate).toLocaleDateString()}`,
          entityType: 'inspection',
          entityId: inspection.id,
        },
      });
    } else {
      // No inspection, deactivate immediately
      await prisma.unitTenant.updateMany({
        where: {
          unitId: id,
          tenantId,
          isActive: true,
        },
        data: {
          isActive: false,
          moveOutDate: new Date(moveOutDate),
        },
      });
      
      // Update unit status to AVAILABLE
      await prisma.unit.update({
        where: { id },
        data: { status: 'AVAILABLE' },
      });
    }
    
    // Notify tenant about move-out
    await prisma.notification.create({
      data: {
        userId: tenantId,
        type: 'SYSTEM',
        title: 'Move-out Scheduled',
        message: `Your move-out from Unit ${unit.unitNumber} is scheduled for ${new Date(moveOutDate).toLocaleDateString()}`,
        entityType: 'unit',
        entityId: id,
      },
    });
    
    res.json({
      success: true,
      message: createInspection 
        ? 'Move-out inspection scheduled. Tenant will be deactivated after inspection.'
        : 'Tenant moved out successfully',
      inspection,
      unit: {
        ...unit,
        status: createInspection ? 'PENDING_MOVE_OUT' : 'AVAILABLE',
      },
    });
  } catch (error) {
    console.error('Error processing move-out:', error);
    res.status(500).json({ error: 'Failed to process move-out' });
  }
};

/**
 * Remove a tenant from a unit
 */
exports.removeTenant = async (req, res) => {
  try {
    const { id, tenantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'PROPERTY_MANAGER') {
      return res.status(403).json({ error: 'Only property managers can remove tenants' });
    }
    
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: { property: true },
    });
    
    if (!unit || unit.property.managerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Set tenant as inactive instead of deleting
    await prisma.unitTenant.updateMany({
      where: {
        unitId: id,
        tenantId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    
    // Check if unit has any remaining active tenants
    const remainingTenants = await prisma.unitTenant.count({
      where: {
        unitId: id,
        isActive: true,
      },
    });
    
    // Update unit status if no active tenants
    if (remainingTenants === 0) {
      await prisma.unit.update({
        where: { id },
        data: { status: 'AVAILABLE' },
      });
    }
    
    res.json({ message: 'Tenant removed successfully' });
  } catch (error) {
    console.error('Error removing tenant:', error);
    res.status(500).json({ error: 'Failed to remove tenant' });
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
    const tenant = await prisma.unitTenant.findFirst({
      where: {
        unit: { propertyId },
        tenantId: userId,
        isActive: true,
      },
    });
    return !!tenant;
  }
  
  return false;
}
