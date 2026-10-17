'use client';

import { Landmark, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const BANK_DETAILS: { label: string; value: string }[] = [
  { label: 'Type', value: 'Business Adv Fundamentals' },
  { label: 'Account number', value: '325189022493' },
  { label: 'Routing number (paper & electronic)', value: '121000358' },
  { label: 'Routing number (wires)', value: '026009593' },
];

const optionClass =
  'flex flex-col items-center gap-2 rounded-xl p-3 cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950';

/** Bank transfer and Cash App options shown below the PayPal buttons. */
export function ManualPaymentOptions() {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-400 to-amber-200 p-4 text-zinc-950">
      <Dialog>
        <DialogTrigger className={optionClass}>
          <Landmark className="w-9 h-9 text-sky-700" />
          <span className="text-sm sm:text-base font-bold underline underline-offset-2">Pay with Bank</span>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pay with Bank Transfer</DialogTitle>
            <DialogDescription>
              Send the payment to the account below, then share the receipt with our team in chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <dl className="space-y-1.5">
              {BANK_DETAILS.map((d) => (
                <div key={d.label}>
                  <dt className="text-muted-foreground text-xs">{d.label}</dt>
                  <dd className="font-semibold font-mono select-all">{d.value}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-muted-foreground text-xs">For an international wire, use one of our SWIFT codes:</p>
              <p>
                SWIFT code: <strong className="font-mono select-all">BOFAUS3N</strong>
                <br />
                Bank of America, N.A. 222 Broadway, New York, NY 10038
              </p>
              <p className="text-muted-foreground text-xs pt-1">When sent in foreign currency:</p>
              <p>
                SWIFT code: <strong className="font-mono select-all">BOFAUS6S</strong>
                <br />
                Bank of America, N.A. 555 California St., San Francisco, CA 94104
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger className={optionClass}>
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#00d64f]">
            <DollarSign className="w-6 h-6 text-white stroke-[3]" />
          </span>
          <span className="text-sm sm:text-base font-bold underline underline-offset-2">Pay with Cashapp</span>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay with Cash App</DialogTitle>
            <DialogDescription>Scan the code or send to $humantekart.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/payments/cashapp-qr.png"
              alt="Cash App QR code for $humantekart"
              className="w-64 max-w-full rounded-2xl"
            />
            <p className="text-sm font-medium select-all">humantekart@gmail.com</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
