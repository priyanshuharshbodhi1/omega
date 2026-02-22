"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import toast from "react-hot-toast";
import Link from "next/link";
import { useState } from "react";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters long",
  }),
  email: z.string().email(),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters long",
  }),
});

export default function Register() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    toast.loading("Signing up...");

    fetch("/api/register", {
      method: "POST",
      body: JSON.stringify(values),
    })
      .then((res) => res.json())
      .then((data) => {
        toast.dismiss();
        if (data.success) {
          toast.success(data.message);
          router.push("/login");
        } else {
          toast.error(data.message);
        }
        setIsSubmitting(false);
      })
      .catch((error) => {
        toast.dismiss();
        toast.error(error.message);
        setIsSubmitting(false);
      });
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#EEE1CF] [background-image:radial-gradient(circle_at_top,_#fff8ed_0%,_#eee1cf_55%,_#e4d6c3_100%)]">
      <div className="max-w-lg w-full mx-auto px-4">
        <div className="text-center mb-8">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] mb-2">
            Let’s Get Started
          </div>
          <h1 className="font-medium text-2xl md:text-3xl text-[#1F1A15]">
            Sign Up
          </h1>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-[#FFFDF7] p-6 rounded-2xl border border-[#D2C4B3] shadow-[0_16px_40px_rgba(55,40,25,0.18)]">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Your name" disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Your email address" disabled={isSubmitting} />
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
                    <Input {...field} type="password" placeholder="Your password" disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting}>Sign Up</Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-[#4B3F35]">
          Already have an account?{" "}
          <Link href="/login" className="underline text-[#1F1A15]">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
