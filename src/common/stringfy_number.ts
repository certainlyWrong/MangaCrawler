export const stringifyNumber = (number: number): string => {
  if (number < 10) {
    return `0${number}`;
  }
  return number.toString();
};
