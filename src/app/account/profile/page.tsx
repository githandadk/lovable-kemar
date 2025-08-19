"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthStatus from "@/components/AuthStatus";

const ProfileSchema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  korean_name: z.string().optional().nullable(),
  email: z.string().email("Invalid email"),
  phone: z.string().min(7, "Too short").max(20, "Too long"),
  age_years: z.coerce.number().int().min(0).max(120),
  home_church: z.string().optional().nullable(),
});

type ProfileForm = z.infer<typeof ProfileSchema>;

export default function ProfilePage() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({ resolver: zodResolver(ProfileSchema) });

  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "first_name,last_name,korean_name,email,phone,age_years,home_church"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        reset({
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
          korean_name: data.korean_name ?? "",
          email: data.email ?? user.email ?? "",
          phone: data.phone ?? "",
          age_years: data.age_years ?? 0,
          home_church: data.home_church ?? "",
        });
      } else {
        reset({
          first_name: "",
          last_name: "",
          korean_name: "",
          email: user?.email ?? "",
          phone: "",
          age_years: 0,
          home_church: "",
        });
      }
      setLoading(false);
    }
    load();
  }, [supabase, user, reset]);

  async function onSubmit(values: ProfileForm) {
    if (!user) {
      alert("Please sign in to save your profile.");
      return;
    }
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: user.id, ...values }),
    });
    const json = await res.json();
    if (!json.ok) {
      alert(`Save failed: ${json.error ?? "Unknown error"}`);
      return;
    }
    alert("Profile saved!");
  }

  if (!user) {
    return (
      <main className="p-6 max-w-xl mx-auto space-y-2">
        <AuthStatus />
        <p>Please sign in to edit your profile.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <AuthStatus />
        Loading…
      </main>
    );
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <AuthStatus />
      <h1 className="text-2xl font-semibold mb-4">Your Profile</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">First name</label>
          <input
            {...register("first_name")}
            className="mt-1 w-full border rounded p-2"
          />
          {errors.first_name && (
            <p className="text-red-600 text-sm">{errors.first_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Last name</label>
          <input
            {...register("last_name")}
            className="mt-1 w-full border rounded p-2"
          />
          {errors.last_name && (
            <p className="text-red-600 text-sm">{errors.last_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Korean name</label>
          <input
            {...register("korean_name")}
            className="mt-1 w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            {...register("email")}
            className="mt-1 w-full border rounded p-2"
          />
          {errors.email && (
            <p className="text-red-600 text-sm">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Phone</label>
          <input
            {...register("phone")}
            className="mt-1 w-full border rounded p-2"
          />
          {errors.phone && (
            <p className="text-red-600 text-sm">{errors.phone.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Age</label>
          <input
            type="number"
            {...register("age_years")}
            className="mt-1 w-full border rounded p-2"
          />
          {errors.age_years && (
            <p className="text-red-600 text-sm">{errors.age_years.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Home church</label>
          <input
            {...register("home_church")}
            className="mt-1 w-full border rounded p-2"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex items-center rounded border px-4 py-2 hover:bg-gray-50"
        >
          {isSubmitting ? "Saving…" : "Save profile"}
        </button>
      </form>
    </main>
  );
}
