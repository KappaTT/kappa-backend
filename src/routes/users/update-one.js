import middyfy from 'middleware';
import createHttpError from 'http-errors';
import oc from 'js-optchain';

import { updateUser } from 'services/user';

const _handler = async (event, context) => {
  const target = decodeURIComponent(event.pathParameters?.target);

  if (!event.authorized || (target !== event.user.email && !event.user.privileged)) {
    console.error(`${event.user?.email} tried to update ${target}`);

    throw new createHttpError.Unauthorized('Not authorized');
  }

  const ocBody = oc(event.body, {
    changes: {}
  });

  // membership tier is web-chair-only; test key PRESENCE, not truthiness, so a falsy value
  // like '' cannot slip a PNM out of their restrictions
  const changesType = Object.prototype.hasOwnProperty.call(ocBody.changes, 'type');

  if (event.user.role?.toLowerCase() !== 'web') {
    if (ocBody.changes.email || ocBody.changes.role || ocBody.changes.privileged || changesType) {
      throw new createHttpError.Unauthorized('Not authorized');
    }
  }

  if (!event.user.privileged) {
    if (
      ocBody.changes.givenName ||
      ocBody.changes.familyName ||
      ocBody.changes.firstYear ||
      ocBody.changes.semester ||
      ocBody.changes.email ||
      ocBody.changes.role ||
      ocBody.changes.privileged
    ) {
      throw new createHttpError.Unauthorized('Not authorized');
    }
  }

  if (changesType) {
    // normalize to the only two valid tiers, and a PNM can never be privileged
    ocBody.changes.type = ocBody.changes.type === 'PNM' ? 'PNM' : 'B';

    if (ocBody.changes.type === 'PNM') {
      ocBody.changes.privileged = false;
    }
  }

  const updatedUser = await updateUser(target, ocBody.changes);

  if (!updatedUser.success) {
    throw new createHttpError.InternalServerError('Could not update user');
  }

  console.log('Updated user', updatedUser);

  return {
    statusCode: 200,
    body: {
      user: updatedUser.data.user
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
