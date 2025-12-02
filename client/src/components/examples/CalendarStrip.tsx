import { CalendarStrip } from "../CalendarStrip";

export default function CalendarStripExample() {
  return (
    <CalendarStrip
      onDateSelect={(date) => console.log("Date selected:", date)}
    />
  );
}
