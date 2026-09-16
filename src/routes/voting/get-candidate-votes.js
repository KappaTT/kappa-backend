import middyfy from 'middleware';
import createHttpError from 'http-errors';
import oc from 'js-optchain';

import { isWebChair } from 'utils/auth';
import { getSessionVotes, getVotesBySession } from 'services/voting';

const _handler = async (event, context) => {
  if (!event.authorized || !event.user.privileged) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  const ocBody = oc(event.body, {
    session: {
      _id: ''
    },
    candidate: {
      _id: ''
    }
  });

  if (ocBody.session._id === '' || ocBody.candidate._id === '') {
    throw new createHttpError.BadRequest('Missing required fields');
  }

  // Only the web chair may see how brothers voted. Other officers get just their own votes rather
  // than an error or an empty list: the desktop overwrites its vote store with each response, so an
  // empty list would wipe the officer's own vote off their screen on builds that still poll this route

  const foundVotes = isWebChair(event.user)
    ? await getSessionVotes(ocBody.session._id)
    : await getVotesBySession(event.user.email, ocBody.session._id);

  if (!foundVotes.success) {
    throw new createHttpError.InternalServerError('Could not get votes');
  }

  console.log('Found votes', ocBody.session._id, ocBody.candidate._id, foundVotes);

  return {
    statusCode: 200,
    body: {
      session: {
        _id: ocBody.session._id
      },
      candidate: {
        _id: ocBody.candidate._id
      },
      votes: foundVotes.data.votes
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
