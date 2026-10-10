import { For } from "solid-js";

import { formatCalendarMonthName } from "~/domain/time/app-time";
import { calendarMonthParts } from "~/domain/time/calendar-date";

import type { Group } from "../../model/group";
import { EventGroup } from "../event-group";

import styles from "./styles.module.css";

type EventListProps = {
  id: string;
  groups: Group[];
};

export function EventList(props: EventListProps) {
  return (
    <div
      id={`scroll-wrapper-scroll-wrapper-event-list-${props.id}`}
      class={`${styles.scrollWrapper} scroll-wrapper-x-enabled scroll-wrapper-y-enabled`}
    >
      <div class={styles.container}>
        <For each={props.groups}>
          {(group, index) => {
            const monthLabel = formatCalendarMonthName(group.month);

            const showYear =
              index() === 0 ||
              calendarMonthParts(group.month).year !==
                calendarMonthParts(
                  props.groups[index() - 1]?.month ?? group.month,
                ).year;

            return (
              <EventGroup
                group={group}
                monthLabel={monthLabel}
                showYear={showYear}
              />
            );
          }}
        </For>
      </div>
    </div>
  );
}
