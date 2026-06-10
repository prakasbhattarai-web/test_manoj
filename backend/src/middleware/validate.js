/**
 * Validation middleware helpers using express-validator.
 */

const { validationResult, body, query, param } = require('express-validator');

/**
 * Runs after a chain of express-validator checks.
 * If there are errors it returns 422 with a structured error list.
 * Otherwise it calls next().
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ---------------------------------------------------------------------------
// Validation rule sets (exported as arrays ready to spread into route defs)
// ---------------------------------------------------------------------------

const validateCreateAppointment = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[\d\s\-()+.]{7,20}$/).withMessage('Must be a valid phone number'),

  body('serviceId')
    .trim()
    .notEmpty().withMessage('Service ID is required'),

  body('date')
    .trim()
    .notEmpty().withMessage('Date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
    .custom((value) => {
      const date = new Date(value + 'T00:00:00');
      if (isNaN(date.getTime())) throw new Error('Invalid date');
      // Allow today and future dates only
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) throw new Error('Date cannot be in the past');
      return true;
    }),

  body('timeSlot')
    .trim()
    .notEmpty().withMessage('Time slot is required')
    .matches(/^\d{2}:\d{2}$/).withMessage('Time slot must be in HH:MM format'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must be 500 characters or fewer'),

  handleValidationErrors,
];

const validateUpdateAppointment = [
  param('id')
    .trim()
    .notEmpty().withMessage('Appointment ID is required'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-()+.]{7,20}$/).withMessage('Must be a valid phone number'),

  body('date')
    .optional()
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
    .custom((value) => {
      const date = new Date(value + 'T00:00:00');
      if (isNaN(date.getTime())) throw new Error('Invalid date');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) throw new Error('Date cannot be in the past');
      return true;
    }),

  body('timeSlot')
    .optional()
    .trim()
    .matches(/^\d{2}:\d{2}$/).withMessage('Time slot must be in HH:MM format'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must be 500 characters or fewer'),

  handleValidationErrors,
];

const validateAvailabilityQuery = [
  query('date')
    .trim()
    .notEmpty().withMessage('date query parameter is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be in YYYY-MM-DD format'),

  query('serviceId')
    .optional()
    .trim(),

  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateCreateAppointment,
  validateUpdateAppointment,
  validateAvailabilityQuery,
};
