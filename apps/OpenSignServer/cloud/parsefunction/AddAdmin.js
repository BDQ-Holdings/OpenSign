import crypto from 'node:crypto';

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.toLowerCase().replace(/\s/g, '') : '';
}

export function hasValidBootstrapToken(providedToken) {
  const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!expectedToken || typeof providedToken !== 'string') {
    return false;
  }

  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

export async function authorizeInitialAdmin(request, requestedEmail) {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.SESSION_MISSING, 'An authenticated user is required.');
  }

  const authenticatedEmail = normalizeEmail(
    request.user.get('email') || request.user.get('username')
  );
  if (!requestedEmail || requestedEmail !== authenticatedEmail) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'The authenticated user does not match the requested administrator.'
    );
  }

  if (!hasValidBootstrapToken(request.params.bootstrapToken)) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Invalid administrator bootstrap token.');
  }

  const adminQuery = new Parse.Query('contracts_Users');
  adminQuery.equalTo('UserRole', 'contracts_Admin');
  adminQuery.notEqualTo('IsDisabled', true);
  const existingAdmin = await adminQuery.first({ useMasterKey: true });
  if (existingAdmin) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'An administrator already exists.');
  }

  return {
    id: request.user.id,
    sessionToken: request.user.getSessionToken(),
  };
}

async function addTeamAndOrg(extUser) {
  try {
    const extUserCls = new Parse.Query('contracts_Users');
    const updateUser = await extUserCls.get(extUser.objectId, { useMasterKey: true });
    if (updateUser && !updateUser?.get('OrganizationId')) {
      const orgCls = new Parse.Object('contracts_Organizations');
      orgCls.set('Name', extUser.Company);
      orgCls.set('IsActive', true);
      orgCls.set('ExtUserId', {
        __type: 'Pointer',
        className: 'contracts_Users',
        objectId: extUser?.objectId,
      });
      orgCls.set('CreatedBy', {
        __type: 'Pointer',
        className: '_User',
        objectId: extUser?.UserId?.objectId,
      });
      orgCls.set('TenantId', {
        __type: 'Pointer',
        className: 'partners_Tenant',
        objectId: extUser?.TenantId?.objectId,
      });

      const orgRes = await orgCls.save(null, { useMasterKey: true });
      const teamCls = new Parse.Object('contracts_Teams');
      teamCls.set('Name', 'All Users');
      teamCls.set('OrganizationId', {
        __type: 'Pointer',
        className: 'contracts_Organizations',
        objectId: orgRes.id,
      });
      teamCls.set('IsActive', true);
      const teamRes = await teamCls.save(null, { useMasterKey: true });
      // const updateUser = new Parse.Object('contracts_Users');
      // updateUser.id = extUser.objectId;
      updateUser.set('UserRole', 'contracts_Admin');
      updateUser.set('OrganizationId', {
        __type: 'Pointer',
        className: 'contracts_Organizations',
        objectId: orgRes.id,
      });
      updateUser.set('TeamIds', [
        {
          __type: 'Pointer',
          className: 'contracts_Teams',
          objectId: teamRes.id,
        },
      ]);
      const extUserRes = await updateUser.save(null, { useMasterKey: true });
    }
  } catch (err) {
    console.log('err in add team, role, org', err);
  }
}

export default async function AddAdmin(request) {
  const requestedDetails = request.params?.userDetails;
  if (!requestedDetails || typeof requestedDetails !== 'object') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Administrator details are required.');
  }

  const email = normalizeEmail(requestedDetails.email);
  const userDetails = {
    ...requestedDetails,
    email,
    role: 'contracts_Admin',
  };
  const user = await authorizeInitialAdmin(request, email);

  try {
    const extQuery = new Parse.Query('contracts_Users');
    extQuery.equalTo('UserId', {
      __type: 'Pointer',
      className: '_User',
      objectId: user.id,
    });
    const extUser = await extQuery.first({ useMasterKey: true });
    if (extUser) {
      return { message: 'User already exist' };
    } else {
      const partnerQuery = new Parse.Object('partners_Tenant');
      partnerQuery.set('UserId', {
        __type: 'Pointer',
        className: '_User',
        objectId: user.id,
      });

      if (userDetails?.phone) {
        partnerQuery.set('ContactNumber', userDetails.phone);
      }
      partnerQuery.set('TenantName', userDetails.company);
      partnerQuery.set('EmailAddress', userDetails.email?.toLowerCase()?.replace(/\s/g, ''));
      partnerQuery.set('IsActive', true);
      partnerQuery.set('CreatedBy', {
        __type: 'Pointer',
        className: '_User',
        objectId: user.id,
      });
      if (userDetails && userDetails.pincode) {
        partnerQuery.set('PinCode', userDetails.pincode);
      }
      if (userDetails && userDetails.country) {
        partnerQuery.set('Country', userDetails.country);
      }
      if (userDetails && userDetails.state) {
        partnerQuery.set('State', userDetails.state);
      }
      if (userDetails && userDetails.city) {
        partnerQuery.set('City', userDetails.city);
      }
      if (userDetails && userDetails.address) {
        partnerQuery.set('Address', userDetails.address);
      }
      const tenantRes = await partnerQuery.save(null, { useMasterKey: true });
      // console.log("tenantRes ", tenantRes);
      const newObj = new Parse.Object('contracts_Users');
      newObj.set('UserId', {
        __type: 'Pointer',
        className: '_User',
        objectId: user.id,
      });
      newObj.set('UserRole', userDetails.role);
      newObj.set('Email', userDetails.email?.toLowerCase()?.replace(/\s/g, ''));
      newObj.set('Name', userDetails.name);
      if (userDetails?.phone) {
        newObj.set('Phone', userDetails?.phone);
      }
      newObj.set('TenantId', {
        __type: 'Pointer',
        className: 'partners_Tenant',
        objectId: tenantRes.id,
      });
      if (userDetails && userDetails.company) {
        newObj.set('Company', userDetails.company);
      }
      if (userDetails && userDetails.jobTitle) {
        newObj.set('JobTitle', userDetails.jobTitle);
      }
      if (userDetails?.timezone) {
        newObj.set('Timezone', userDetails?.timezone);
      }
      const extRes = await newObj.save(null, { useMasterKey: true });
      const extUser = {
        objectId: extRes.id,
        Name: userDetails.name,
        Email: userDetails.email?.toLowerCase()?.replace(/\s/g, ''),
        Phone: userDetails?.phone ? userDetails.phone : '',
        TenantId: { objectId: tenantRes.id },
        UserId: { objectId: user.id },
        UserRole: userDetails.role,
        Company: userDetails.company,
        JobTitle: userDetails.jobTitle,
      };
      await addTeamAndOrg(extUser);
      return { message: 'User sign up', sessionToken: user.sessionToken };
    }
  } catch (err) {
    console.log('Err ', err);
  }
}
