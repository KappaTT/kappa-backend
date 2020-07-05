import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { deleteCandidate } from 'services/voting';

const _handler = async (event, context) => {
  const target = decodeURIComponent(event.pathParameters?.target);

  if (!event.authorized || !event.user.privileged) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  if (!target) {
    throw new createHttpError.BadRequest('Invalid target');
  }

  const deletedCandidate = await deleteCandidate(target);

  if (!deletedCandidate.success) {
    throw new createHttpError.InternalServerError('Could not delete candidate');
  }

  return {
    statusCode: 200,
    body: {
      candidate: {
        _id: target
      }
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
