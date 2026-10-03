'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Mail, Loader2, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({
          text: 'Account created! Please check your email for the confirmation link.',
          type: 'success',
        });
        toast.success('Account created! Verification link sent.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Signed in successfully!');
        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setMessage({ text: msg, type: 'error' });
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    setEmail('creator@humantek.art');
    setPassword('DemoPass2026!');
    toast.info('Loaded demo creator credentials. Click Sign In.');
  };

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={
        <Link href="/">
          <Button variant="outline" size="sm" className="text-xs rounded-xl cursor-pointer">
            Open Studio Wizard
          </Button>
        </Link>
      }
    >
      <div className="flex items-center justify-center py-6 animate-in fade-in duration-200">
        <div className="w-full max-w-md space-y-4">
          <Card className="rounded-3xl border-border bg-card shadow-lg p-6 sm:p-8">
            <CardHeader className="p-0 text-center space-y-2 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-base flex items-center justify-center mx-auto shadow-md shadow-amber-500/20">
                ART
              </div>
              <CardTitle className="text-2xl font-black text-foreground">
                {isSignUp ? 'Create Studio Account' : 'Sign in to Creator Studio'}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Access your project tracker, credit wallets, and agency briefs.
              </CardDescription>
            </CardHeader>

            {message && (
              <Alert variant={message.type === 'success' ? 'info' : 'destructive'} className="mb-4 rounded-xl">
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <AlertTitle className="text-sm font-bold">{message.type === 'success' ? 'Verification Sent' : 'Auth Error'}</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed">{message.text}</AlertDescription>
              </Alert>
            )}

            <CardContent className="p-0">
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-muted-foreground" /> Email address
                  </Label>
                  <Input
                    type="email"
                    required
                    placeholder="creator@channel.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-muted-foreground" /> Password
                  </Label>
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl h-10 text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  variant="default"
                  disabled={isLoading}
                  className="w-full text-sm font-semibold gap-2 mt-2 h-10"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
                    </>
                  ) : isSignUp ? (
                    'Create Studio Account'
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                  Or
                </span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDemoSignIn}
                className="w-full text-sm gap-2 font-medium rounded-xl h-10 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                Fill Demo Creator Credentials
              </Button>
            </CardContent>

            <CardFooter className="p-0 mt-6 pt-4 border-t border-border flex justify-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setMessage(null);
                }}
                className="text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer"
              >
                {isSignUp
                  ? 'Already have an account? Sign in instead'
                  : "Don't have an account yet? Create one"}
              </button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </StudioCardLayout>
  );
}
