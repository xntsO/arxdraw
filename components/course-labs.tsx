'use client';

import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { courseLabs } from '@/lib/course-labs';
import type { CourseLab } from '@/lib/course-labs';
import { diagramKinds } from '@/lib/practice';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const STORAGE = 'arxdraw.comp371.v1';
type Progress = { selected: string; checked: Record<string, number[]> };
function loadProgress(preferredLabId?: string): Progress {
  const preferred = courseLabs.find((lab) => lab.id === preferredLabId)?.id;
  const fallback: Progress = {
    selected: preferred ?? courseLabs[0]?.id ?? '',
    checked: {},
  };
  try {
    const source: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
    if (!source || typeof source !== 'object') return fallback;
    if (
      'selected' in source &&
      !preferred &&
      typeof source.selected === 'string' &&
      courseLabs.some((lab) => lab.id === source.selected)
    )
      fallback.selected = source.selected;
    if (
      'checked' in source &&
      source.checked &&
      typeof source.checked === 'object'
    ) {
      for (const [id, values] of Object.entries(source.checked)) {
        const lab = courseLabs.find((item) => item.id === id);
        if (lab && Array.isArray(values))
          fallback.checked[id] = [
            ...new Set(
              values.filter(
                (value): value is number =>
                  typeof value === 'number' &&
                  Number.isInteger(value) &&
                  value >= 0 &&
                  value < lab.checklist.length,
              ),
            ),
          ];
      }
    }
  } catch {}
  return fallback;
}
const kindName = (kind: CourseLab['kind']) =>
  kind === 'class'
    ? 'Class'
    : (diagramKinds.find((item) => item.id === kind)?.label ?? kind);

export function CourseLabs({
  open,
  onOpenChange,
  onStart,
  preferredLabId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (lab: CourseLab, mode: 'blank' | 'example') => void;
  preferredLabId?: string;
}) {
  const [progress, setProgress] = useState(() => loadProgress(preferredLabId));
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const selected =
    courseLabs.find((lab) => lab.id === progress.selected) ?? courseLabs[0];
  const kinds = [...new Set(courseLabs.map((lab) => lab.kind))];
  const filtered = courseLabs.filter(
    (lab) =>
      (kind === 'all' || lab.kind === kind) &&
      `${lab.number} ${lab.title} ${kindName(lab.kind)} ${lab.objectives.join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  function update(next: Progress) {
    setProgress(next);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  function start(lab: CourseLab, mode: 'blank' | 'example') {
    setError('');
    try {
      onStart(lab, mode);
      onOpenChange(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'This exercise could not be opened.',
      );
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="arx-labs-dialog">
        <DialogHeader>
          <DialogTitle className="arx-labs-title">
            <BookOpen size={20} aria-hidden="true" /> COMP371 labs
          </DialogTitle>
          <DialogDescription>
            {courseLabs.length} exercises from your lab manual. Practice from a
            blank diagram or study an editable worked example.
          </DialogDescription>
        </DialogHeader>
        <div className="arx-labs-filters">
          <label className="arx-labs-search" htmlFor="comp371-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search exercises</span>
            <Input
              id="comp371-search"
              type="search"
              placeholder="Search by topic, number or diagram…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="arx-labs-kind">
            <span className="sr-only">Diagram type</span>
            <select
              aria-label="Diagram type"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">All diagram types</option>
              {kinds.map((value) => (
                <option key={value} value={value}>
                  {kindName(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="arx-labs-body">
          <nav className="arx-labs-list" aria-label="COMP371 exercises">
            <output className="arx-labs-count">
              {filtered.length} of {courseLabs.length} exercises
            </output>
            {filtered.map((lab) => (
              <button
                type="button"
                key={lab.id}
                aria-current={selected?.id === lab.id ? 'true' : undefined}
                onClick={() => {
                  update({ ...progress, selected: lab.id });
                  setError('');
                }}
              >
                <span className="arx-lab-number">
                  {lab.practice ? lab.number : `Lab ${lab.number}`}
                </span>
                <strong>{lab.title}</strong>
                <small>
                  {kindName(lab.kind)} · Manual p. {lab.page}
                </small>
              </button>
            ))}
            {!filtered.length && (
              <p className="arx-labs-empty">
                No exercises match. Try another search or diagram type.
              </p>
            )}
          </nav>
          {selected && (
            <section
              className="arx-lab-detail"
              aria-label={`${selected.title} exercise`}
            >
              <div className="arx-lab-meta">
                {selected.practice
                  ? 'Practice exercise'
                  : `Lab ${selected.number}`}{' '}
                · {kindName(selected.kind)} · Manual p. {selected.page}
              </div>
              <h2>{selected.title}</h2>
              <ul className="arx-lab-objectives">
                {selected.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
              <div className="arx-lab-actions">
                <Button onClick={() => start(selected, 'blank')}>
                  Start blank
                </Button>
                <Button
                  variant="outline"
                  onClick={() => start(selected, 'example')}
                >
                  Open worked example
                </Button>
              </div>
              <p className="arx-lab-note">
                Adds diagrams to your current workspace. Undo removes the
                addition. For separate exercises, use New in the main menu after
                saving your work.
              </p>
              <p className="arx-lab-note">
                Worked examples are original possible answers for study. They
                are not official solutions.
              </p>
              <fieldset className="arx-lab-checklist">
                <legend>
                  Self-check · {progress.checked[selected.id]?.length ?? 0}/
                  {selected.checklist.length}
                </legend>
                <p>
                  Tick these after reviewing your diagram. This is your
                  checklist, not automatic grading.
                </p>
                {selected.checklist.map((check, index) => (
                  <label key={check}>
                    <input
                      type="checkbox"
                      checked={
                        progress.checked[selected.id]?.includes(index) ?? false
                      }
                      onChange={(event) => {
                        const current = progress.checked[selected.id] ?? [];
                        update({
                          ...progress,
                          checked: {
                            ...progress.checked,
                            [selected.id]: event.target.checked
                              ? [...current, index]
                              : current.filter((value) => value !== index),
                          },
                        });
                      }}
                    />
                    <span>{check}</span>
                  </label>
                ))}
              </fieldset>
              <p className="arx-lab-note">
                Reopen COMP371 labs to continue this checklist. Use Check model
                for supported structural checks, and Save project or Export SVG
                to keep your work.
              </p>
              {storageError && (
                <p className="arx-code-error" role="alert">
                  Browser storage is unavailable. Your checklist will last only
                  for this session.
                </p>
              )}
              {error && (
                <p className="arx-code-error" role="alert">
                  {error}
                </p>
              )}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
