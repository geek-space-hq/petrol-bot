export function dateTime(date: Date) {
  const dateString = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  const timeString = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
  return `${dateString} ${timeString}`;
}
