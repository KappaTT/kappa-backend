import middyfy from 'middleware';
import createHttpError from 'http-errors';

import { getAdvice, deleteAdvice } from 'services/course';

const _handler = async (event, context) => {
  const target = decodeURIComponent(event.pathParameters?.target);

  if (!event.authorized) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  if (!target) {
    throw new createHttpError.BadRequest('Invalid target');
  }

  const foundAdvice = await getAdvice(target);

  if (!foundAdvice.success || !foundAdvice.data.advice) {
    throw new createHttpError.BadRequest('Advice not found');
  }

  if (
    foundAdvice.data.advice.email !== event.user.email &&
    !(event.user.privileged && event.user.role?.toLowerCase() === 'web')
  ) {
    throw new createHttpError.Unauthorized('Not authorized to delete this advice');
  }

  const deletedAdvice = await deleteAdvice(target);

  if (!deletedAdvice.success) {
    throw new createHttpError.InternalServerError('Could not delete advice');
  }

  console.log('Deleted advice', target);

  return {
    statusCode: 200,
    body: {
      advice: {
        _id: target
      }
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
