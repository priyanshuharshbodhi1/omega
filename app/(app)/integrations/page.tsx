"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeam } from "@/lib/store";
import { Globe, Link, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

export default function Dashboard() {
  const [link, setLink] = useState("");
  const [snippet, setSnippet] = useState("");
  const team = useTeam((state) => state.team);

  useEffect(() => {
    if (team) {
      setLink(`${process.env.NEXT_PUBLIC_BASE_URL}/collect/${team?.id}`);
      setSnippet(
        `<script src="${process.env.NEXT_PUBLIC_BASE_URL}/omega.js" omega-id="${team?.id}"></script>`,
      );
    }
  }, [team]);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold text-xl">Integrations</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div className="w-full bg-white border rounded-lg p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-10 bg-brand/10 text-brand rounded-md flex items-center justify-center">
              <Globe className="size-5" />
            </div>
            <h5 className="font-bold">Website</h5>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Embed feedback widgets with your websites easily
          </p>
          <AlertDialog>
            <AlertDialogTrigger
              className={buttonVariants({ variant: "dark", size: "sm" })}
            >
              Connect
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Embed to your website</AlertDialogTitle>
                <AlertDialogDescription>
                  <p className="mb-2">
                    Add this script before <strong>{`</body>`}</strong> on your
                    site:
                  </p>
                  <Input
                    value={snippet}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="w-full bg-white border rounded-lg p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-10 bg-brand/10 text-brand rounded-md flex items-center justify-center">
              <Link className="size-5" />
            </div>
            <h5 className="font-bold">Quick Link</h5>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Share a quick link to interact directly with the widgets
          </p>
          <AlertDialog>
            <AlertDialogTrigger
              className={buttonVariants({ variant: "dark", size: "sm" })}
            >
              Connect
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Quick Link</AlertDialogTitle>
                <AlertDialogDescription>
                  <p className="mb-2">Share this link with your customers:</p>
                  <Input
                    value={link}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="w-full bg-white border rounded-lg p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-10 bg-brand/10 text-brand rounded-md flex items-center justify-center">
              <QrCode className="size-5" />
            </div>
            <h5 className="font-bold">QR Code</h5>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Download & Share QR code to interact directly
          </p>
          <AlertDialog>
            <AlertDialogTrigger
              className={buttonVariants({ variant: "dark", size: "sm" })}
            >
              Connect
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>QR Code</AlertDialogTitle>
                <AlertDialogDescription>
                  <QRCode
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={link}
                    viewBox={`0 0 256 256`}
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  );
}
