export function dateTime(date: Date) {
  const padNumber = (value: number) => `0${value}`.slice(-2);

  const dateString = `${date.getFullYear()}/${padNumber(date.getMonth() + 1)}/${padNumber(date.getDate())}`;
  const timeString = `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}`;
  return `${dateString} ${timeString}`;
}
