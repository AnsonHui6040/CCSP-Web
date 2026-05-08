import { Navbar } from "@/components/Navbar";
import { ScheduleClient } from "./ScheduleClient";

export const dynamic = "force-static";

export default function SchedulePage() {
  return (
    <>
      <Navbar active="schedule" />
      <main className="mx-auto max-w-7xl px-6 py-6">
        <ScheduleClient />
      </main>
    </>
  );
}
