import middyfy from 'middleware';
import createHttpError from 'http-errors';
import moment from 'moment';
import oc from 'js-optchain';

import {
  normalizeCourseCode,
  getCourse,
  getOfficialCourseByCodeKey,
  createCourseFromOfficial,
  createRequestedCourse,
  createEnrollment
} from 'services/course';

const _handler = async (event, context) => {
  if (!event.authorized) {
    throw new createHttpError.Unauthorized('Not authorized');
  }

  const ocBody = oc(event.body, {
    enrollment: {
      courseId: '',
      courseCode: '',
      courseTitle: '',
      term: '',
      requestNew: false
    }
  });

  if (ocBody.enrollment.term.trim() === '') {
    throw new createHttpError.BadRequest('Missing required fields');
  }

  let course = null;

  if (ocBody.enrollment.courseId !== '') {
    // enrolling in a course that is already on the chapter's list

    const foundCourse = await getCourse(ocBody.enrollment.courseId);

    if (!foundCourse.success || !foundCourse.data.course) {
      throw new createHttpError.BadRequest('Course not found');
    }

    course = foundCourse.data.course;
  } else if (ocBody.enrollment.courseCode.trim() !== '') {
    // adding a class by code, which must match the official university catalog unless it is
    // explicitly requested as a new course for an officer to approve

    const { code, codeKey } = normalizeCourseCode(ocBody.enrollment.courseCode);

    const foundOfficialCourse = await getOfficialCourseByCodeKey(codeKey);

    if (foundOfficialCourse.success && foundOfficialCourse.data.course) {
      const createdCourse = await createCourseFromOfficial({
        officialCourse: foundOfficialCourse.data.course,
        creator: event.user.email,
        createdAt: moment().toISOString()
      });

      if (!createdCourse.success) {
        throw new createHttpError.InternalServerError('Could not create course');
      }

      course = createdCourse.data.course;
    } else if (ocBody.enrollment.requestNew === true) {
      const createdCourse = await createRequestedCourse({
        code,
        codeKey,
        title: ocBody.enrollment.courseTitle.trim(),
        creator: event.user.email,
        createdAt: moment().toISOString()
      });

      if (!createdCourse.success) {
        throw new createHttpError.InternalServerError('Could not create course');
      }

      course = createdCourse.data.course;
    } else {
      throw new createHttpError.BadRequest('That course is not in the university catalog');
    }
  } else {
    throw new createHttpError.BadRequest('Missing required fields');
  }

  const createdEnrollment = await createEnrollment({
    courseId: course._id,
    email: event.user.email,
    term: ocBody.enrollment.term.trim(),
    createdAt: moment().toISOString()
  });

  if (!createdEnrollment.success) {
    throw new createHttpError.InternalServerError('Could not create enrollment');
  }

  console.log('Enrolled', event.user.email, course.code, ocBody.enrollment.term);

  return {
    statusCode: 200,
    body: {
      course,
      enrollment: createdEnrollment.data.enrollment
    }
  };
};

export const handler = middyfy(_handler, {
  authorized: true,
  useMongo: true
});
