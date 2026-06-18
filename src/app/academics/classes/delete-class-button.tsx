"use client";

import { useRef } from "react";
import { removeClass } from "../actions";

// Native-confirm wrapper around removeClass. Deleting a class cascades
// sections + subjects + fee structures and nulls students.class_id — worth
// a misclick guard before submitting.
export default function DeleteClassButton({
  classId,
  label,
}: {
  classId: string;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={removeClass} className="inline">
      <input type="hidden" name="id" value={classId} />
      <button
        type="button"
        onClick={() => {
          if (
            window.confirm(
              `Delete "${label}"? Sections, subjects and the fee structure for this class will be removed. Students keep their record but get unassigned from the class.`
            )
          ) {
            formRef.current?.requestSubmit();
          }
        }}
        className="text-xs text-red-600 hover:text-red-800 hover:underline"
      >
        Delete class
      </button>
    </form>
  );
}
