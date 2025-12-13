/**
 * Role Management Utilities
 * Helper functions for managing user roles and permissions
 */

// Define roles (matching Prisma schema)
const ROLES = {
  PROPERTY_MANAGER: 'PROPERTY_MANAGER',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  TECHNICIAN: 'TECHNICIAN',
  TENANT: 'TENANT'
};

/**
 * Get user with their role-specific profile
 */
export async function getUserWithProfile(prisma, userId) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenantProfile: true,
      technicianProfile: true,
      propertyManagerProfile: true,
      ownerProfile: true,
      org: true
    }
  });
}

/**
 * Assign a role to a user and create their profile
 */
export async function assignRole(prisma, userId, role, profileData = {}) {
  // Validate role
  if (!Object.values(ROLES).includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  // Update user role
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role }
  });

  // Create role-specific profile
  switch (role) {
    case ROLES.TECHNICIAN:
      await prisma.technicianProfile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData
      });
      break;

    case ROLES.PROPERTY_MANAGER:
      await prisma.propertyManagerProfile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData
      });
      break;

    case ROLES.OWNER:
      await prisma.ownerProfile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData
      });
      break;

    case ROLES.TENANT:
      await prisma.tenantProfile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData
      });
      break;
  }

  return await getUserWithProfile(prisma, userId);
}

/**
 * Grant property access to a property manager
 */
export async function grantPropertyManagerAccess(prisma, userId, propertyIds) {
  const profile = await prisma.propertyManagerProfile.findUnique({
    where: { userId }
  });

  if (!profile) {
    throw new Error('User is not a property manager');
  }

  const currentProperties = profile.managedProperties || [];
  const updatedProperties = [...new Set([...currentProperties, ...propertyIds])];

  return await prisma.propertyManagerProfile.update({
    where: { userId },
    data: {
      managedProperties: updatedProperties
    }
  });
}

/**
 * Grant property ownership to an owner
 */
export async function grantPropertyOwnership(prisma, userId, propertyIds, assignedByUserId) {
  const profile = await prisma.ownerProfile.findUnique({
    where: { userId }
  });

  if (!profile) {
    throw new Error('User is not an owner');
  }

  const currentProperties = profile.ownedProperties || [];
  const updatedProperties = [...new Set([...currentProperties, ...propertyIds])];

  return await prisma.ownerProfile.update({
    where: { userId },
    data: {
      ownedProperties: updatedProperties,
      assignedBy: assignedByUserId
    }
  });
}

/**
 * Grant property access to a technician
 */
export async function grantTechnicianAccess(prisma, userId, propertyIds, canAccessAll = false) {
  const profile = await prisma.technicianProfile.findUnique({
    where: { userId }
  });

  if (!profile) {
    throw new Error('User is not a technician');
  }

  if (canAccessAll) {
    return await prisma.technicianProfile.update({
      where: { userId },
      data: {
        canAccessAllProperties: true
      }
    });
  }

  const currentProperties = profile.propertyAccess || [];
  const updatedProperties = [...new Set([...currentProperties, ...propertyIds])];

  return await prisma.technicianProfile.update({
    where: { userId },
    data: {
      propertyAccess: updatedProperties
    }
  });
}

/**
 * Check if user has permission to perform an action
 */
export function hasPermission(user, permission) {
  // Check property manager permissions
  if (user.role === ROLES.PROPERTY_MANAGER) {
    const permissions = user.propertyManagerProfile?.permissions || {};
    return permissions[permission] === true;
  }

  return false;
}

/**
 * Get all users by role
 */
export async function getUsersByRole(prisma, role, orgId = null) {
  const where = { role };
  if (orgId) {
    where.orgId = orgId;
  }

  return await prisma.user.findMany({
    where,
    include: {
      tenantProfile: true,
      technicianProfile: true,
      propertyManagerProfile: true,
      ownerProfile: true
    }
  });
}

/**
 * Get properties accessible by user based on their role
 */
export async function getAccessibleProperties(prisma, userId) {
  const user = await getUserWithProfile(prisma, userId);
  
  if (!user) {
    return [];
  }

  // Property managers can access their managed properties
  if (user.role === ROLES.PROPERTY_MANAGER) {
    const propertyIds = user.propertyManagerProfile?.managedProperties || [];
    return await prisma.property.findMany({
      where: { id: { in: propertyIds } }
    });
  }

  // Owners can access their owned properties
  if (user.role === ROLES.OWNER) {
    const propertyIds = user.ownerProfile?.ownedProperties || [];
    return await prisma.property.findMany({
      where: { id: { in: propertyIds } }
    });
  }

  // Technicians can access properties they're assigned to
  if (user.role === ROLES.TECHNICIAN) {
    if (user.technicianProfile?.canAccessAllProperties) {
      return await prisma.property.findMany({
        where: { orgId: user.orgId }
      });
    }
    const propertyIds = user.technicianProfile?.propertyAccess || [];
    return await prisma.property.findMany({
      where: { id: { in: propertyIds } }
    });
  }

  // Tenants can access properties they have units in
  if (user.role === ROLES.TENANT) {
    const links = await prisma.tenantUnitLink.findMany({
      where: { userId, active: true },
      include: { unit: { include: { property: true } } }
    });
    return links.map(link => link.unit.property);
  }

  return [];
}

/**
 * Create a new owner and assign properties to them
 */
export async function createOwnerForProperties(prisma, propertyManagerId, ownerData, propertyIds) {
  // Create the owner user
  const owner = await prisma.user.create({
    data: {
      ...ownerData,
      role: ROLES.OWNER,
      orgId: ownerData.orgId
    }
  });

  // Create owner profile with property assignments
  await prisma.ownerProfile.create({
    data: {
      userId: owner.id,
      ownedProperties: propertyIds,
      assignedBy: propertyManagerId,
      viewOnlyAccess: true
    }
  });

  return await getUserWithProfile(prisma, owner.id);
}

/**
 * Create a technician profile
 */
export async function createTechnician(prisma, technicianData, profileData = {}) {
  const technician = await prisma.user.create({
    data: {
      ...technicianData,
      role: ROLES.TECHNICIAN
    }
  });

  await prisma.technicianProfile.create({
    data: {
      userId: technician.id,
      ...profileData
    }
  });

  return await getUserWithProfile(prisma, technician.id);
}

export default {
  getUserWithProfile,
  assignRole,
  grantPropertyManagerAccess,
  grantPropertyOwnership,
  grantTechnicianAccess,
  hasPermission,
  getUsersByRole,
  getAccessibleProperties,
  createOwnerForProperties,
  createTechnician
};
