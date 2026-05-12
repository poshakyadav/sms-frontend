// attendance-status-docs.component.ts

import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusCategory = 'present' | 'absent' | 'neutral';

export interface ScenarioExample {
  situation: string;
  correct: string;
  incorrect?: string;
  tip?: string;
}

export interface StatusDoc {
  id: string;
  label: string;
  category: StatusCategory;
  tagline: string;
  icon: string;
  affectsPercentage: 'positive' | 'negative' | 'excluded';
  percentageNote: string;
  fullDescription: string;
  whenToUse: string[];
  whenNotToUse: string[];
  examples: ScenarioExample[];
  requiresNote: boolean;
  noteGuidance?: string;
  halfDayDetail?: boolean;
  boardPolicy?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATUS_DOCS: StatusDoc[] = [
  {
    id: 'PRESENT',
    label: 'Present',
    category: 'present',
    tagline: 'Student attended the full school session',
    icon: '✓',
    affectsPercentage: 'positive',
    percentageNote: 'Counts as 1 full day in the attendance percentage.',
    fullDescription:
      'Mark a student PRESENT when they are physically in the classroom for both the morning and afternoon sessions (or for the school\'s full working hours). This is the default and most common status. A student marked PRESENT has their attendance tally increased by 1.0 for the day.',
    whenToUse: [
      'Student is in their seat at roll-call time and present for both sessions.',
      'Student arrives slightly before the official late-mark threshold your school has set.',
      'Student left the campus for a brief approved errand (medical checkup, office work) but attended most of the day — check your school policy; many treat this as PRESENT if attendance was ≥ 75% of the session.',
    ],
    whenNotToUse: [
      'Student arrived after the late cut-off time — use LATE instead.',
      'Student attended only one session (morning or afternoon) — use HALF_DAY.',
      'You have not actually verified the student\'s presence — never mark PRESENT speculatively.',
    ],
    examples: [
      {
        situation: 'Ramesh arrived at 8:45 AM, which is before the 9:00 AM bell. He sat through all periods and left at 3:30 PM.',
        correct: 'Mark PRESENT. He attended the full day with no anomaly.',
      },
      {
        situation: 'Priya arrived at 8:55 AM. Roll call begins at 9:00 AM. She was in her seat before the roll started.',
        correct: 'Mark PRESENT. She was there before roll call began.',
        incorrect: 'Do not mark LATE — she arrived before the official roll-call moment.',
      },
    ],
    requiresNote: false,
  },
  {
    id: 'LATE',
    label: 'Late',
    category: 'present',
    tagline: 'Student arrived after roll call but attended the session',
    icon: '◷',
    affectsPercentage: 'positive',
    percentageNote: 'Counts as 1 full day for percentage — same as PRESENT. Tracked separately for punctuality reports.',
    fullDescription:
      'LATE marks a student who arrived after the official roll-call window but still attended the class. For attendance percentage purposes, LATE is treated identically to PRESENT. However, it is stored as a separate status so the class teacher and principal can generate punctuality reports, identify habitual late-comers, and send targeted communication to parents — without affecting the student\'s attendance record unfairly.',
    whenToUse: [
      'Student arrives after the roll-call bell but before the first period ends (your school may define an exact cut-off — commonly 30 minutes after bell).',
      'Student was late due to a verifiable reason (traffic, illness of a family member in the morning) but still came to school.',
      'Student was attending an assembly or event outside the classroom when roll was called, but was physically on campus.',
    ],
    whenNotToUse: [
      'Student arrived so late that they only attended half the day — use HALF_DAY.',
      'Student arrived after the late cut-off AND you cannot verify the second half either — use ABSENT and let the parent explain.',
      'Student was late because of a school-sanctioned activity (sports meet, debate) — use ON_DUTY instead.',
    ],
    examples: [
      {
        situation: 'Anjali reached school at 9:20 AM. Roll call was at 9:00 AM. She sat through all remaining periods.',
        correct: 'Mark LATE. She was absent at roll call but attended the rest of the day.',
        tip: 'Add a note: "Late arrival 9:20 AM — bus delay" for the parent communication report.',
      },
      {
        situation: 'Suresh arrives at 11:45 AM, which is 2 hours and 45 minutes after roll call. School ends at 3:30 PM.',
        correct: 'Mark HALF_DAY (afternoon). He only attended the afternoon session.',
        incorrect: 'Do not mark LATE — he missed the entire morning. LATE implies the student caught most of the day.',
      },
    ],
    requiresNote: false,
    noteGuidance: 'Optional but recommended: note the arrival time and reason. Useful for parent reports.',
  },
  {
    id: 'HALF_DAY',
    label: 'Half Day',
    category: 'present',
    tagline: 'Student attended only one session — morning or afternoon',
    icon: '◑',
    affectsPercentage: 'positive',
    percentageNote: 'Counts as 0.5 in the attendance percentage. Two HALF_DAY entries = 1.0 present day.',
    fullDescription:
      'HALF_DAY is used when a student was physically present for exactly one session of the school day — either the morning or the afternoon — and absent for the other. You must also select which session they attended: MORNING or AFTERNOON. This is important for generating timetable-accurate records and telling parents exactly which lessons were missed.',
    halfDayDetail: true,
    whenToUse: [
      'Student attended morning session but left after lunch for a medical appointment, family commitment, or other approved reason.',
      'Student arrived very late (e.g. 1:00 PM) and attended only the afternoon session.',
      'School formally releases a student early with written permission from parents for a personal event.',
      'Student had a dental/doctor appointment and was away for exactly half the day with supporting documentation.',
    ],
    whenNotToUse: [
      'Student was present for the full day — use PRESENT.',
      'Student was absent the entire day — use ABSENT, SICK, or EXCUSED depending on the reason.',
      'Student left 15 minutes early — that is effectively PRESENT; check your school\'s policy threshold.',
    ],
    examples: [
      {
        situation: 'Meena attended all morning periods (9:00 AM – 12:30 PM) but her parents picked her up after lunch for a family function. The school has a written permission slip.',
        correct: 'Mark HALF_DAY → MORNING (the session she attended). Add a note: "Left after lunch — family function, parent permission slip #23".',
        tip: 'Always specify MORNING or AFTERNOON so the system knows which lessons were covered.',
      },
      {
        situation: 'Arjun had a dentist appointment until 1:00 PM and came to school for the 1:15 PM period onwards.',
        correct: 'Mark HALF_DAY → AFTERNOON. Add a note: "Late arrival 1:15 PM — dentist appointment".',
      },
    ],
    requiresNote: true,
    noteGuidance: 'Always note which session was attended and the reason for the half-day. Include any reference number from parent permission slips.',
    boardPolicy: 'Most state boards count 2 half-days as 1 full working day for eligibility calculations. Confirm with your school\'s examination rules.',
  },
  {
    id: 'ABSENT',
    label: 'Absent',
    category: 'absent',
    tagline: 'Student did not attend — no prior approval or medical reason given',
    icon: '✗',
    affectsPercentage: 'negative',
    percentageNote: 'Reduces attendance percentage. Counts as 0 for the day.',
    fullDescription:
      'ABSENT is the default "did not come, no explanation" status. Use it when a student is not present and you have received no communication from the parents, no medical certificate, and no prior approval. ABSENT is the starting point — it can later be corrected to SICK or EXCUSED once documentation is provided. It acts as a prompt for the system to generate a parent notification.',
    whenToUse: [
      'Student is simply not in class and no reason has been communicated to the school.',
      'Parent sent a verbal message but no written note or medical certificate has been submitted yet.',
      'Student left home but did not reach school (use this and flag for the school coordinator to follow up immediately).',
      'End of day: student was absent and no reason was provided. You can correct it later if documentation arrives.',
    ],
    whenNotToUse: [
      'A medical certificate has been submitted — use SICK instead.',
      'Parent submitted a written request and the school approved the absence in advance — use EXCUSED.',
      'Student is barred due to a disciplinary action — use SUSPENDED.',
      'The school is closed — use HOLIDAY.',
    ],
    examples: [
      {
        situation: 'Deepak did not come to school on Monday. No message was received from his parents. His seat is empty.',
        correct: 'Mark ABSENT. The system will trigger an automated SMS to parents.',
        tip: 'If a reason arrives by the next day (e.g. illness certificate), update to SICK retroactively.',
      },
      {
        situation: 'Kavya\'s mother called saying she has a cold and won\'t come. No certificate yet.',
        correct: 'Mark ABSENT for now with a note: "Mother called — cold, no certificate submitted." Change to SICK once the certificate arrives.',
        incorrect: 'Do not mark SICK preemptively without documentation — SICK has a different reporting weight in medical reports.',
      },
    ],
    requiresNote: false,
    noteGuidance: 'Add a note if you received a verbal message without documentation. This helps when parents dispute the absence later.',
  },
  {
    id: 'SICK',
    label: 'Sick',
    category: 'absent',
    tagline: 'Student is absent due to illness, with or without medical documentation',
    icon: '🩺',
    affectsPercentage: 'negative',
    percentageNote: 'Reduces attendance percentage — same as ABSENT. Tracked in a separate medical bucket for health dashboards.',
    fullDescription:
      'SICK separates medical absences from unexcused ones in the attendance record. While it affects the percentage identically to ABSENT, the school health officer and principal can run a separate "medical leave report" that helps identify patterns — a student with 12 SICK days in a term may need a health follow-up, whereas the same count showing as ABSENT is a disciplinary concern. SICK also triggers different parent communications in many schools.',
    whenToUse: [
      'Student submitted a doctor\'s certificate or medical note for the absence.',
      'Parent communicated a verifiable illness and the school has a policy of accepting this without a certificate for short absences (1–2 days).',
      'Student was sent home from school by the school nurse due to illness — retroactively correct the day from ABSENT to SICK.',
      'Student has a chronic condition (asthma, diabetes episode, migraine) and the school has a documented health plan on file.',
    ],
    whenNotToUse: [
      'No communication or certificate received — use ABSENT and update later.',
      'Student is skipping due to exam fear or a social event — use ABSENT.',
      'Student took a holiday trip disguised as illness — verify documentation; if suspicious, discuss with principal before marking SICK.',
    ],
    examples: [
      {
        situation: 'Riya was absent Tuesday and Wednesday. On Thursday she returned with a typed doctor\'s note stating "viral fever, advised rest for 2 days."',
        correct: 'Update Tuesday and Wednesday from ABSENT (or leave as SICK from the start if you knew). Add note: "Doctor certificate submitted 12-May-2026, Dr. Sharma, City Clinic."',
        tip: 'Some schools require the original certificate to be submitted to the office. Cross-check with your admin.',
      },
      {
        situation: 'Karan vomited in the second period. The nurse sent him home at 10:30 AM.',
        correct: 'Mark HALF_DAY → MORNING for the session he attended, and note: "Sent home by nurse at 10:30 AM — nausea." Or mark SICK for the full day if the nurse certifies the dismissal.',
        tip: 'Coordinate with the school nurse. Their record is the authoritative source for medically-driven early departures.',
      },
    ],
    requiresNote: true,
    noteGuidance: 'Document the type of illness (if shared), certificate reference number, issuing doctor, and date submitted. This is critical for regulatory inspections.',
  },
  {
    id: 'SUSPENDED',
    label: 'Suspended',
    category: 'absent',
    tagline: 'Student is barred from attending due to a disciplinary action',
    icon: '⚑',
    affectsPercentage: 'negative',
    percentageNote: 'Reduces attendance percentage — counts as absent. Feeds directly into the discipline audit report.',
    fullDescription:
      'SUSPENDED is used exclusively when a formal disciplinary authority (principal, discipline committee) has issued a written suspension order preventing a student from attending school for a specified period. It is not a status teachers apply unilaterally — a suspension must be formally issued and communicated. Once issued, the class teacher marks every day of the suspension period as SUSPENDED. This creates a clean audit trail that is distinct from regular absences, enabling the school to produce accurate conduct reports for board inspections and transfer certificates.',
    whenToUse: [
      'The principal or discipline committee has issued a written suspension order and communicated the dates to you.',
      'Student is involved in a serious misconduct investigation and has been asked not to attend pending inquiry — only after written authorization from the principal.',
      'The suspension order has been formally recorded in the student\'s discipline file (check with the admin office).',
    ],
    whenNotToUse: [
      'You, as a teacher, have decided a student should not attend your class — that is an internal class matter, not a suspension.',
      'A student is repeatedly misbehaving but no formal order has been issued — mark ABSENT and escalate through proper channels.',
      'Student is absent for any other reason — use the appropriate status (ABSENT, SICK, EXCUSED).',
    ],
    examples: [
      {
        situation: 'The principal issued a 3-day suspension (Mon–Wed) to Class 9B\'s Vikas for a serious altercation. You have the written order.',
        correct: 'Mark SUSPENDED for Monday, Tuesday, and Wednesday. In the notes field, write: "Suspension Order #2026-009, issued by Principal on 10-May-2026."',
        tip: 'Never leave this field without a reference number. This protects both the school and the student in any future dispute.',
      },
      {
        situation: 'A student is being very disruptive in class. You tell them to stand outside.',
        incorrect: 'Do NOT mark SUSPENDED. Standing outside the classroom is an in-class disciplinary measure, not a suspension.',
        correct: 'Mark PRESENT. If the disruption is severe enough to warrant suspension, send the student to the principal\'s office and wait for a formal order.',
      },
    ],
    requiresNote: true,
    noteGuidance: 'Always include the suspension order number, date of issue, and the name of the authority who issued it. This is mandatory for TC and board records.',
  },
  {
    id: 'EXCUSED',
    label: 'Excused',
    category: 'neutral',
    tagline: 'Pre-approved absence — does not count against the student',
    icon: '◎',
    affectsPercentage: 'excluded',
    percentageNote: 'Excluded from the working-day denominator entirely. Neither adds to present count nor reduces percentage.',
    fullDescription:
      'EXCUSED is for absences that were approved in advance by the school. Unlike ABSENT or SICK — which reduce attendance percentage — EXCUSED absences are completely excluded from the calculation. The working-day denominator is reduced by one for each EXCUSED day, meaning the student\'s percentage is calculated as if that day never existed. This is appropriate for absences where the school gave explicit permission and it would be unfair to penalise the student.',
    whenToUse: [
      'Parent submitted a written application in advance and the principal or class teacher approved it.',
      'Student is attending a family funeral, religious ceremony, or cultural event with school permission.',
      'Student is representing the school or district in an academic/cultural competition but the absence wasn\'t entered as ON_DUTY — use ON_DUTY for school-organised events; use EXCUSED for external events with school permission.',
      'Student has a scheduled medical procedure (surgery, physiotherapy course) with hospital documentation provided in advance.',
      'Bereavement leave — parent submitted a death certificate or obituary reference.',
    ],
    whenNotToUse: [
      'Parent calls the same day without prior approval — that is ABSENT (or SICK with a certificate). EXCUSED requires prior written approval.',
      'Student went on a family vacation without informing the school — use ABSENT.',
      'Student is representing the school in an official event — use ON_DUTY.',
    ],
    examples: [
      {
        situation: 'Nisha\'s parents submitted a written application two weeks ago for a 5-day trip to attend her grandmother\'s 80th birthday. The class teacher approved it.',
        correct: 'Mark EXCUSED for all 5 days. Note: "Approved leave — family ceremony, application ref. #LA-2026-042, approved by Class Teacher on 01-May-2026."',
        tip: 'The approval must be on record before the absence, not retroactively. Educate parents to apply at least 3 working days in advance.',
      },
      {
        situation: 'Rahul\'s father calls on the day itself saying Rahul is attending a cousin\'s wedding and won\'t come.',
        incorrect: 'Do not mark EXCUSED — no prior written approval was obtained.',
        correct: 'Mark ABSENT. Advise the father to submit a leave application and supporting evidence; the class teacher may then change it to EXCUSED at their discretion per school policy.',
      },
    ],
    requiresNote: true,
    noteGuidance: 'Record the approval reference (form number, who approved, date of approval, and reason). Without this, auditors cannot distinguish a properly excused absence from an improperly backdated one.',
  },
  {
    id: 'HOLIDAY',
    label: 'Holiday',
    category: 'neutral',
    tagline: 'School-declared closure — no attendance expected',
    icon: '◈',
    affectsPercentage: 'excluded',
    percentageNote: 'Excluded from the working-day denominator entirely. This day simply does not exist in the attendance record.',
    fullDescription:
      'HOLIDAY is used when the school itself is closed — whether for a gazetted public holiday, a local event, an unexpected closure (weather, strike, building maintenance), or a scheduled vacation day. It is typically marked in bulk for the entire school or a class-section, not individually per student. When a day is marked HOLIDAY, it is removed from the working-day count for every student, so no one is penalised and no percentages are affected. Most schools pre-configure their academic calendar with all known holidays so teachers don\'t need to manually enter them.',
    whenToUse: [
      'A gazetted public holiday (Independence Day, Republic Day, Diwali, Eid, Christmas, etc.).',
      'A locally observed holiday specific to your region or school management trust.',
      'An unplanned closure: cyclone warning, municipal strike, sudden bereavement of a senior school figure, or a government order.',
      'Examination days where a class is completely free and not expected to be on campus.',
      'Saturday or Sunday if your school accidentally needs to mark a date in the system.',
    ],
    whenNotToUse: [
      'Only one student is absent — that is ABSENT for that individual, not a HOLIDAY.',
      'A specific class has a free period or a teacher is absent — that is an internal substitution issue, not a HOLIDAY for the students.',
      'A student is on vacation — that is ABSENT or EXCUSED for that individual.',
    ],
    examples: [
      {
        situation: 'August 15 is Independence Day. School is closed. You need to complete the month\'s register.',
        correct: 'Mark HOLIDAY for all students on August 15. The system will automatically exclude this day from every student\'s working-day count.',
        tip: 'In most school management systems, holidays are pre-loaded from the academic calendar. Ask your admin to configure the calendar so you don\'t have to manually mark holidays every time.',
      },
      {
        situation: 'A heavy rain warning is issued and the District Collector orders all schools to close on Friday.',
        correct: 'Mark HOLIDAY for Friday for all classes. Add a note: "Unexpected closure — DC order, heavy rain warning, 17-May-2026."',
      },
    ],
    requiresNote: false,
    noteGuidance: 'For unplanned closures, add a brief note with the authority that declared it (DC order number, school notice number). This is important for board compliance records.',
  },
  {
    id: 'ON_DUTY',
    label: 'On Duty',
    category: 'neutral',
    tagline: 'Student is away for an official school-sanctioned activity',
    icon: '◆',
    affectsPercentage: 'excluded',
    percentageNote: 'Excluded from the working-day denominator. Student is considered officially engaged — not absent.',
    fullDescription:
      'ON_DUTY is for students who are away from the classroom but are officially representing the school or participating in a school-organised programme. They are physically not in class, so they cannot be marked PRESENT — but they are not absent either. ON_DUTY removes the day from the denominator, protecting the student\'s percentage. It also creates a positive record showing the student\'s co-curricular involvement, which is valuable for cumulative records and character certificates.',
    whenToUse: [
      'Student is participating in an inter-school sports meet, science olympiad, quiz competition, or debate as a representative of the school.',
      'Student is attending an NCC/NSS camp, scout/guide camp, or a government-organised youth programme with school permission.',
      'Student is on a school-organised field trip or educational excursion.',
      'Student is acting as a student representative at a district/state educational event.',
      'Student is participating in a school cultural event, annual day rehearsal that requires missing class time (with principal approval).',
    ],
    whenNotToUse: [
      'Student is attending an external event without school representation (a private tuition exam, personal coaching camp) — use EXCUSED if approved, ABSENT if not.',
      'Teacher is on duty (this status is for students only).',
      'Student skipped class and later claims they were "on duty" — verify with the organising teacher or principal before marking.',
    ],
    examples: [
      {
        situation: 'Class 10 student Vikram was selected to represent the school at the District Science Exhibition on Tuesday and Wednesday. You have received a circular from the science teacher.',
        correct: 'Mark ON_DUTY for Tuesday and Wednesday. Note: "District Science Exhibition, Vikram selected by Science Dept. Circular ref. #SCI-EXH-2026-04."',
        tip: 'Ask the student to bring back the participation certificate or an acknowledgement from the event organiser. File it with the attendance register.',
      },
      {
        situation: 'Ten students from Class 8 are on a 2-day school trip to the wildlife sanctuary.',
        correct: 'Mark ON_DUTY for those 10 students for both days. The remaining 25 students are marked normally (PRESENT/ABSENT as applicable).',
        incorrect: 'Do not mark HOLIDAY for the whole class — the students who stayed have a normal school day.',
      },
    ],
    requiresNote: true,
    noteGuidance: 'Record the name of the event, organising body, and the teacher/authority who authorised the ON_DUTY status. Attach or reference the circular or permission letter.',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-attendance-status-docs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance-status-docs.html',
  styleUrl: './attendance-status-docs.scss',
})
export class AttendanceStatusDocs implements OnInit, OnDestroy {

  allDocs = STATUS_DOCS;

  sidebarOpen   = signal(false);
  activeFilter  = signal<'all' | StatusCategory>('all');
  activeStatusId = signal<string>('');
  searchQuery = '';

  private observer?: IntersectionObserver;
  private filteredCache = signal<StatusDoc[]>(STATUS_DOCS);

  filteredPresentDocs = computed(() =>
    this.filteredCache().filter(d => d.category === 'present')
  );
  filteredAbsentDocs = computed(() =>
    this.filteredCache().filter(d => d.category === 'absent')
  );
  filteredNeutralDocs = computed(() =>
    this.filteredCache().filter(d => d.category === 'neutral')
  );

  ngOnInit() {
    this.setupIntersectionObserver();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  onSearch() {
    const q = this.searchQuery.toLowerCase().trim();
    const cat = this.activeFilter();
    this.filteredCache.set(
      STATUS_DOCS.filter(d => {
        const matchesCat = cat === 'all' || d.category === cat;
        const matchesQ   = !q ||
          d.label.toLowerCase().includes(q) ||
          d.tagline.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q);
        return matchesCat && matchesQ;
      })
    );
  }

  scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.activeStatusId.set(id);
    }
    if (window.innerWidth <= 900) this.sidebarOpen.set(false);
  }

  effectLabel(effect: string): string {
    return effect === 'positive' ? 'Adds to %'
         : effect === 'negative' ? 'Reduces %'
         : 'Excluded';
  }

  categoryLabel(cat: StatusCategory): string {
    return cat === 'present' ? 'Present-equivalent'
         : cat === 'absent'  ? 'Absent-equivalent'
         : 'Special / Neutral';
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.sidebarOpen.set(false);
  }

  private setupIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length) {
          const topmost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          );
          this.activeStatusId.set(topmost.target.id);
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );

    // Observe after render
    setTimeout(() => {
      STATUS_DOCS.forEach(doc => {
        const el = document.getElementById(doc.id);
        if (el) this.observer!.observe(el);
      });
    }, 100);
  }
}