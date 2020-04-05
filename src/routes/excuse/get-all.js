import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { getPendingExcuses } from 'services/event';

const _handler = async (event, context) => {
  if (!event.authorized || !event.user.privileged) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  const allExcuses = await getPendingExcuses();

  if (!allExcuses.success) {
    throw new createHttpError.InternalServerError('Could not get excuses');
  }

  return {
    statusCode: 200,
    body: {
      excused: allExcuses.data?.excuses
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true,
  useSql: true
});
