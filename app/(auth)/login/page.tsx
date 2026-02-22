"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { set, z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import toast from "react-hot-toast";
import Link from "next/link";
import { useState } from "react";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters long",
  }),
});

export default function Login() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    toast.loading("Logging in...");

    fetch("/api/login", {
      method: "POST",
      body: JSON.stringify(values),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then(async (res) => {
        toast.dismiss();
        if (res.success) {
          await signIn("credentials", { ...values, callbackUrl: "/dashboard" });
        } else {
          toast.error(res.message);
        }

        setIsSubmitting(false);
      })
      .catch((err) => {
        toast.dismiss();
        toast.error(err.message);
        setIsSubmitting(false);
      });
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#EEE1CF] [background-image:radial-gradient(circle_at_top,_#fff8ed_0%,_#eee1cf_55%,_#e4d6c3_100%)]">
      <div className="max-w-lg w-full mx-auto px-4">
        <div className="text-center mb-8">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] mb-2">
            Welcome Back
          </div>
          <h1 className="font-medium text-2xl md:text-3xl text-[#1F1A15]">
            Sign In
          </h1>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 bg-[#FFFDF7] p-6 rounded-2xl border border-[#D2C4B3] shadow-[0_16px_40px_rgba(55,40,25,0.18)]"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Your email address"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Your password"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting}>
              Sign In
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-[#4B3F35]">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="underline text-[#1F1A15]">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
