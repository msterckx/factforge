"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface ImageUploadProps {
  currentImage?: string | null;
  name?: string;
}

export default function ImageUpload({ currentImage, name = "image" }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [removed, setRemoved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type. Allowed: jpg, png, gif, webp.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Maximum size is 5MB.");
      e.target.value = "";
      return;
    }

    setPreview(URL.createObjectURL(file));
    setRemoved(false);
  }

  function handleRemove() {
    setPreview(null);
    setRemoved(true);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  return (
    <div>
      {preview && (
        <div className="relative w-full aspect-video mb-3 rounded-lg overflow-hidden bg-slate-100">
          <Image
            src={preview}
            alt="Preview"
            fill
            className="object-contain"
            sizes="(max-width: 672px) 100vw, 672px"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleChange}
          className="text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
        />
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>

      {/* Hidden field to signal image removal on edit */}
      {removed && <input type="hidden" name="removeImage" value="true" />}
    </div>
  );
}
