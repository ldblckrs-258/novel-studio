"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ReadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/novels/${id}/read/1`);
  }, [id, router]);

  return null;
}
