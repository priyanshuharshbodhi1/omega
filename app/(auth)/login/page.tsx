"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { set, z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
          await signIn("credentials", values);
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
    <div className="flex items-center justify-center h-screen">
      <div className="max-w-lg w-full mx-auto px-4">
        <h1 className="font-bold text-center text-xl md:text-2xl lg:text-3xl mb-8">Sign In</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-white p-4 md:p-6 rounded-md border shadow-sm">
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
              )} />
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
              )} />
              <Button type="submit" disabled={isSubmitting}>Sign In</Button>
          </form>
        </Form>
        <p className="mt-6 text-center">Don&apos;t have an account? <Link href="/register" className="underline">Sign Up</Link></p>
      </div>
    </div>
  );
}
