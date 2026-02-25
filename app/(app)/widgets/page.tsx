"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe2, Save, SendHorizontal, Settings2, XIcon } from "lucide-react";
import { ChromePicker } from "react-color";
import clsx from "clsx";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useTeam } from "@/lib/store";
import { InfoTip } from "@/components/ui/info-tip";

const formSchema = z.object({
  button_bg: z.string(),
  button_color: z.string(),
  button_text: z.string(),
  button_position: z.string(),
  form_bg: z.string(),
  form_color: z.string(),
  form_title: z.string(),
  form_subtitle: z.string(),
  form_rate_text: z.string(),
  form_details_text: z.string(),
  form_button_text: z.string(),
  widget_mode: z.enum(["feedback", "customer_agent"]),
  support_title: z.string(),
  support_subtitle: z.string(),
  support_placeholder: z.string(),
});

export default function Page() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const team = useTeam((state) => state.team);
  const setTeam = useTeam((state) => state.setTeam);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      button_bg: "#FF204E",
      button_color: "#FFFFFF",
      button_text: "Give Feedback",
      button_position: "right",
      form_bg: "#FF204E",
      form_color: "#FFFFFF",
      form_title: "Your Feedback Matters",
      form_subtitle: "Let us hear your thoughts",
      form_rate_text: "Rate your overall experience",
      form_details_text: "Add more details",
      form_button_text: "Send Feedback",
      widget_mode: "feedback",
      support_title: "Omega Support Assistant",
      support_subtitle: "Get instant help with citations",
      support_placeholder: "Ask a question about docs, setup, billing...",
    },
  });

  useEffect(() => {
    if (!team?.style) return;
    const style = team.style || {};
    form.setValue("button_bg", style.button_bg || "#FF204E");
    form.setValue("button_color", style.button_color || "#FFFFFF");
    form.setValue("button_text", style.button_text || "Give Feedback");
    form.setValue("button_position", style.button_position || "right");
    form.setValue("form_bg", style.form_bg || "#FF204E");
    form.setValue("form_color", style.form_color || "#FFFFFF");
    form.setValue("form_title", style.form_title || "Your Feedback Matters");
    form.setValue("form_subtitle", style.form_subtitle || "Let us hear your thoughts");
    form.setValue("form_rate_text", style.form_rate_text || "Rate your overall experience");
    form.setValue("form_details_text", style.form_details_text || "Add more details");
    form.setValue("form_button_text", style.form_button_text || "Send Feedback");
    form.setValue("widget_mode", style.widget_mode || "feedback");
    form.setValue("support_title", style.support_title || "Omega Support Assistant");
    form.setValue(
      "support_subtitle",
      style.support_subtitle || "Get instant help with citations",
    );
    form.setValue(
      "support_placeholder",
      style.support_placeholder || "Ask a question about docs, setup, billing...",
    );
  }, [team, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!team?.id) return;
    setIsSubmitting(true);
    toast.loading("Saving...");

    fetch("/api/team/style", {
      method: "POST",
      body: JSON.stringify({ teamId: team.id, style: values }),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((res) => {
        toast.dismiss();
        if (res.success) {
          toast.success("Saved successfully!");
          setTeam(res.data);
        } else {
          toast.error(res.message || "Failed to save");
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader className="border-b py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
                  Widget Settings
                </h2>
                <InfoTip text="Customize your embedded widget appearance and mode (feedback vs Omega support)." />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="form">Feedback Form</TabsTrigger>
                  <TabsTrigger value="button">Button Trigger</TabsTrigger>
                  <TabsTrigger value="mode">Mode + Support</TabsTrigger>
                </TabsList>

                <TabsContent
                  value="form"
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="form_bg">Background</Label>
                    <Popover>
                      <PopoverTrigger
                        className="w-full h-10 rounded-full border border-dashed border-black text-xs text-black/50"
                        style={{ background: form.watch("form_bg") }}
                      />
                      <PopoverContent className="p-0 bg-transparent border-none shadow-none flex items-center justify-center">
                        <ChromePicker
                          color={form.watch("form_bg")}
                          onChangeComplete={(color: any) => {
                            form.setValue("form_bg", color.hex);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form_color">Foreground</Label>
                    <Popover>
                      <PopoverTrigger
                        className="w-full h-10 rounded-full border border-dashed border-black text-xs text-black/50"
                        style={{ background: form.watch("form_color") }}
                      />
                      <PopoverContent className="p-0 bg-transparent border-none shadow-none flex items-center justify-center">
                        <ChromePicker
                          color={form.watch("form_color")}
                          onChangeComplete={(color: any) => {
                            form.setValue("form_color", color.hex);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {[
                    "form_title",
                    "form_subtitle",
                    "form_rate_text",
                    "form_details_text",
                    "form_button_text",
                  ].map((name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{name.replaceAll("_", " ")}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={isSubmitting} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </TabsContent>

                <TabsContent
                  value="button"
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="button_bg">Background</Label>
                    <Popover>
                      <PopoverTrigger
                        className="w-full h-10 rounded-full border border-dashed border-black text-xs text-black/50"
                        style={{ background: form.watch("button_bg") }}
                      />
                      <PopoverContent className="p-0 bg-transparent border-none shadow-none flex items-center justify-center">
                        <ChromePicker
                          color={form.watch("button_bg")}
                          onChangeComplete={(color: any) => {
                            form.setValue("button_bg", color.hex);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="button_color">Foreground</Label>
                    <Popover>
                      <PopoverTrigger
                        className="w-full h-10 rounded-full border border-dashed border-black text-xs text-black/50"
                        style={{ background: form.watch("button_color") }}
                      />
                      <PopoverContent className="p-0 bg-transparent border-none shadow-none flex items-center justify-center">
                        <ChromePicker
                          color={form.watch("button_color")}
                          onChangeComplete={(color: any) => {
                            form.setValue("button_color", color.hex);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <FormField
                    control={form.control}
                    name="button_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Button text</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="button_position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Position" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="right">Right</SelectItem>
                              <SelectItem value="left">Left</SelectItem>
                              <SelectItem value="bottom-left">Bottom Left</SelectItem>
                              <SelectItem value="bottom-right">Bottom Right</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="mode" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="widget_mode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Widget mode
                          <InfoTip text="Feedback shows rating form; Customer Support Agent shows Omega chat widget." />
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="feedback">Feedback Form</SelectItem>
                              <SelectItem value="customer_agent">Customer Support Agent</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="support_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support title</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="support_subtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support subtitle</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="support_placeholder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support input placeholder</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-xl border border-[#D2C4B3] bg-[#FFFDF7] p-4 text-xs text-[#4B3F35]">
                    Support knowledge indexing has moved to the Integrations tab for links and PDFs.
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="border-t py-3">
              <Button
                variant="dark"
                type="submit"
                disabled={isSubmitting}
                className="gap-2"
              >
                <Save className="w-5" />
                Save
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>

      <Card>
        <CardHeader className="border-b py-4">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35]">
            Preview
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className="relative w-full aspect-square bg-[#E6D8C6]"
            style={{
              backgroundColor: "#E6D8C6",
              backgroundImage: "radial-gradient(#9B8772 0.6px, #E6D8C6 0.6px)",
              backgroundSize: "10px 10px",
            }}
          >
            <Tabs
              defaultValue="form"
              className="w-full flex items-center justify-center pt-4"
            >
              <TabsList>
                <TabsTrigger value="form">Feedback Form</TabsTrigger>
                <TabsTrigger value="button">Button Trigger</TabsTrigger>
                <TabsTrigger value="support">Support Agent</TabsTrigger>
              </TabsList>
              <TabsContent value="form">
                <div className="absolute bottom-4 right-4 max-w-[330px] w-full bg-[#FFFDF7] rounded-2xl border border-[#D2C4B3] shadow-[0_16px_40px_rgba(55,40,25,0.18)]">
                  <div
                    className="w-full min-h-[390px] rounded-2xl p-3"
                    style={{ backgroundColor: form.watch("form_bg") }}
                  >
                    <div
                      className="flex items-start justify-between mb-2"
                      style={{ color: form.watch("form_color") }}
                    >
                      <div>
                        <h6 className="font-bold text-sm">{form.watch("form_title")}</h6>
                        <p className="text-xs">{form.watch("form_subtitle")}</p>
                      </div>
                      <button
                        type="button"
                        className="p-1 bg-white/50 rounded-full"
                        style={{ color: form.watch("form_bg") }}
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="bg-white/90 rounded-lg p-3">
                      <p className="text-xs mb-2">{form.watch("form_rate_text")}</p>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="w-full bg-white aspect-square shadow rounded-md border"
                          >
                            <span className="text-xs">{n}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs mb-2 mt-3">{form.watch("form_details_text")}</p>
                      <textarea
                        className="w-full rounded border p-3 placeholder:text-sm mb-2"
                        rows={4}
                        placeholder="Please let us know what's your feedback"
                      />

                      <Button
                        type="button"
                        variant="brand"
                        className="w-full"
                        style={{
                          background: form.watch("form_bg"),
                          color: form.watch("form_color"),
                        }}
                      >
                        {form.watch("form_button_text")}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="button">
                <div
                  className={clsx(
                    {
                      "absolute right-0 px-4 py-2 rounded-t-lg -rotate-90 bottom-2/3 origin-bottom-right":
                        form.watch("button_position") === "right",
                    },
                    {
                      "absolute left-0 px-4 py-2 rounded-t-lg rotate-90 bottom-2/3 origin-bottom-left":
                        form.watch("button_position") === "left",
                    },
                    {
                      "absolute right-4 px-4 py-2 rounded-t-lg bottom-0":
                        form.watch("button_position") === "bottom-right",
                    },
                    {
                      "absolute left-4 px-4 py-2 rounded-t-lg bottom-0":
                        form.watch("button_position") === "bottom-left",
                    },
                  )}
                  style={{
                    background: form.watch("button_bg"),
                    color: form.watch("button_color"),
                  }}
                >
                  {form.watch("button_text")}
                </div>
              </TabsContent>
              <TabsContent value="support">
                <div className="absolute bottom-4 right-4 max-w-[330px] w-full bg-[#FFFDF7] rounded-2xl border border-[#D2C4B3] shadow-[0_16px_40px_rgba(55,40,25,0.18)] overflow-hidden">
                  <div
                    className="px-4 py-3 flex items-start justify-between"
                    style={{ backgroundColor: form.watch("form_bg"), color: form.watch("form_color") }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-9 rounded-full bg-white/85 text-[#1F1A15] grid place-content-center font-bold text-sm">
                        A
                      </div>
                      <div>
                        <h6 className="font-bold text-sm">{form.watch("support_title")}</h6>
                        <p className="text-xs opacity-90">{form.watch("support_subtitle")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" className="p-1 bg-white/40 rounded-full">
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button type="button" className="p-1 bg-white/40 rounded-full">
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b border-[#D2C4B3] bg-[#FFFDF7] text-xs text-[#1F1A15]">
                    <label className="font-semibold flex items-center gap-2 mb-2">
                      <Globe2 className="w-3.5 h-3.5" />
                      Language
                    </label>
                    <div className="w-full rounded-lg border border-[#D2C4B3] px-3 py-2 bg-white text-xs">
                      English
                    </div>
                  </div>
                  <div className="bg-[#FFFDF7] h-[210px] p-3">
                    <div className="rounded-xl px-3 py-2 text-sm bg-white border border-[#D2C4B3] text-[#1F1A15] max-w-[85%]">
                      Hi! I'm here to help. Ask me anything and I'll find the answer for you.
                    </div>
                  </div>
                  <div className="border-t border-[#D2C4B3] bg-white p-3 flex items-end gap-2">
                    <textarea
                      className="w-full resize-none rounded-lg border border-[#D2C4B3] px-3 py-2 text-xs"
                      rows={2}
                      placeholder={form.watch("support_placeholder")}
                      readOnly
                    />
                    <Button type="button" size="icon">
                      <SendHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
