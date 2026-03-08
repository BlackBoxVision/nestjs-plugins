import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function ValidSortBy(
  allowedFields: string[],
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'validSortBy',
      target: object.constructor,
      propertyName,
      options: {
        message: `sortBy must be one of: ${allowedFields.join(', ')}`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (value === undefined || value === null) return true;
          return typeof value === 'string' && allowedFields.includes(value);
        },
      },
    });
  };
}
