'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  appendMember,
  memberRows,
  serializeMembers,
  updateMember,
} from '@/lib/members';
import type {
  MemberFields,
  MemberKind,
  MemberRow,
  Visibility,
} from '@/lib/members';

const visibilities = [
  { value: '-', label: '− Private' },
  { value: '+', label: '+ Public' },
  { value: '#', label: '# Protected' },
  { value: '~', label: '~ Package' },
  { value: 'none', label: 'Unspecified' },
];
export function MemberEditor({
  kind,
  value,
  onChange,
}: {
  kind: MemberKind;
  value: string;
  onChange: (value: string) => void;
}) {
  const [rows, setRows] = useState<MemberRow[]>(() => memberRows(value, kind));
  const [rawMode, setRawMode] = useState(false);
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) {
      setRows(memberRows(value, kind));
      emitted.current = value;
    }
  }, [value, kind]);
  const title = kind === 'attributes' ? 'Attributes' : 'Operations';
  const member = kind === 'attributes' ? 'attribute' : 'operation';
  function publish(next: MemberRow[]) {
    const serialized = serializeMembers(next);
    setRows(next);
    emitted.current = serialized;
    onChange(serialized);
  }
  function edit(index: number, patch: Partial<MemberFields>) {
    publish(
      rows.map((row, i) =>
        i === index ? updateMember(row, patch, kind) : row,
      ),
    );
  }
  return (
    <section className="field arx-member-editor" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setRawMode(!rawMode)}
        >
          {rawMode ? 'Fields' : 'Text'}
        </Button>
      </div>
      {rawMode ? (
        <Textarea
          aria-label={title}
          rows={5}
          value={value}
          onChange={(event) => {
            emitted.current = event.target.value;
            setRows(memberRows(event.target.value, kind));
            onChange(event.target.value);
          }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <div
              key={index}
              className="flex flex-col gap-1.5 rounded-md border border-input p-2"
            >
              <div className="flex items-center gap-1">
                {row.fields ? (
                  <>
                    <Select
                      value={row.fields.visibility || 'none'}
                      items={visibilities}
                      onValueChange={(next) =>
                        next &&
                        edit(index, {
                          visibility:
                            next === 'none' ? '' : (next as Visibility),
                        })
                      }
                    >
                      <SelectTrigger
                        className="w-16 shrink-0"
                        aria-label={`${member} ${index + 1} visibility`}
                      >
                        <SelectValue>
                          {row.fields.visibility || '·'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {visibilities.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label={`${member} ${index + 1} name`}
                      placeholder="Name"
                      className="min-w-0"
                      value={row.fields.name}
                      onChange={(event) =>
                        edit(index, { name: event.target.value })
                      }
                    />
                  </>
                ) : (
                  <span className="flex-1 text-xs text-muted-foreground">
                    Signature {index + 1}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${member} ${index + 1}`}
                  title={`Delete ${member}`}
                  onClick={() => publish(rows.filter((_, i) => i !== index))}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              {row.fields ? (
                <>
                  {kind === 'operations' && (
                    <Input
                      aria-label={`operation ${index + 1} parameters`}
                      placeholder="Parameters: id: String"
                      value={row.fields.parameters}
                      onChange={(event) =>
                        edit(index, { parameters: event.target.value })
                      }
                    />
                  )}
                  <Input
                    aria-label={`${member} ${index + 1} ${kind === 'operations' ? 'return type' : 'type'}`}
                    placeholder={kind === 'operations' ? 'Return type' : 'Type'}
                    value={row.fields.type}
                    onChange={(event) =>
                      edit(index, { type: event.target.value })
                    }
                  />
                </>
              ) : (
                <Textarea
                  aria-label={`${member} ${index + 1} signature`}
                  rows={2}
                  value={row.raw}
                  onChange={(event) =>
                    publish(
                      rows.map((item, i) =>
                        i === index
                          ? { raw: event.target.value, fields: null }
                          : item,
                      ),
                    )
                  }
                />
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => publish(appendMember(rows, kind))}
          >
            <Plus size={14} /> Add {member}
          </Button>
        </div>
      )}
    </section>
  );
}
