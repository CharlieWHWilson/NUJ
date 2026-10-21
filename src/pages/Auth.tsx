import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getRegistrationNameError, registerUser, loginUser, requestPasswordReset } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AuthMode = "login" | "register" | "reset";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [errorMessage, setErrorMessage] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const submitReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await requestPasswordReset(loginEmail);
      setSuccessMessage("If an account exists for that email, you'll receive a password reset link.");
    } catch (failure) {
      setErrorMessage(failure instanceof Error ? failure.message : "Couldn't send a reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    const result = await loginUser({
      email: loginEmail,
      password: loginPassword,
    });

    setLoading(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    navigate("/");
  };

  const submitRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const nameError = getRegistrationNameError(registerName);
    if (nameError) {
      setErrorMessage(nameError);
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await registerUser({
      name: registerName,
      email: registerEmail,
      password: registerPassword,
    });
    setLoading(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    if (result.requiresEmailConfirmation) {
      setSuccessMessage("Account created. Check your email to verify your account, then log in.");
      setMode("login");
      return;
    }

    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto px-5 nuj-safe-top-auth nuj-safe-bottom-page">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">NUJ</h1>
        <p className="text-sm text-muted-foreground mt-2">Sign in or create an account</p>
      </div>

      <div className="nuj-card p-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => {
              setMode("login");
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className={`h-10 rounded-xl text-sm font-medium transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setMode("register");
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className={`h-10 rounded-xl text-sm font-medium transition-colors ${mode === "register" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Register
          </button>
        </div>

        {errorMessage && (
          <p role="alert" className="text-sm text-destructive mb-4">{errorMessage}</p>
        )}

        {successMessage && (
          <p role="status" className="text-sm text-success mb-4">{successMessage}</p>
        )}

        {mode === "reset" ? (
          <form className="space-y-3" onSubmit={(event) => void submitReset(event)}>
            <h2 className="text-base font-semibold">Reset password</h2>
            <Input type="email" aria-label="Reset email" placeholder="Email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required disabled={loading} />
            <button type="submit" disabled={loading} className="w-full h-11 nuj-btn-primary disabled:opacity-50">{loading ? "Sending..." : "Send reset link"}</button>
            <button type="button" onClick={() => { setMode("login"); setErrorMessage(""); setSuccessMessage(""); }} className="text-xs text-muted-foreground underline">Back to login</button>
          </form>
        ) : mode === "login" ? (
          <form className="space-y-3" onSubmit={submitLogin}>
            <Input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              required
            />
            <button type="submit" className="w-full h-11 nuj-btn-primary">
              Log in
            </button>
            <button type="button" onClick={() => { setMode("reset"); setErrorMessage(""); setSuccessMessage(""); }} className="text-xs text-muted-foreground underline">Forgot password?</button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={submitRegister}>
            <Input
              type="text"
              placeholder="Name"
              value={registerName}
              onChange={(event) => setRegisterName(event.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={registerEmail}
              onChange={(event) => setRegisterEmail(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={registerPassword}
              onChange={(event) => setRegisterPassword(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Confirm password"
              value={registerConfirmPassword}
              onChange={(event) => setRegisterConfirmPassword(event.target.value)}
              required
            />
            <button type="submit" className="w-full h-11 nuj-btn-primary">
              Create account
            </button>
            <p className="text-xs text-muted-foreground pt-1 text-center">
              By creating an account, you agree to our{" "}
              <Link to="/terms" className="underline">Terms of Use</Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          </form>
        )}
      </div>

      <div className="mt-4 text-center">
        <Dialog>
          <DialogTrigger asChild>
            <button className="inline-flex items-center justify-center rounded-full border border-muted-foreground/40 px-5 py-3 text-base font-medium text-muted-foreground shadow-sm transition-colors hover:border-foreground/30 hover:text-foreground">
              What is NUJ?
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <Dialog>
              <DialogTrigger asChild>
                <button
                  className="absolute left-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Get in touch"
                >
                  <MessageCircle size={16} />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader className="text-center">
                  <DialogTitle className="text-center">Get in touch</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground pt-1 text-center">
                    If you have any questions or would like to share feedback I'd love to hear from you
                  </DialogDescription>
                </DialogHeader>
                <p className="text-sm font-medium text-foreground text-center">charlie@nuj.social</p>
                <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-center gap-3">
                  <Link to="/support" className="underline underline-offset-2">Support</Link>
                  <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
                  <Link to="/terms" className="underline underline-offset-2">Terms of Use</Link>
                </div>
              </DialogContent>
            </Dialog>

            <DialogHeader>
              <DialogTitle className="text-center">What is NUJ?</DialogTitle>
            </DialogHeader>

            <div className="text-sm text-muted-foreground space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <p>NUJ is the easy way to stay connected with mates. No pressure, guilt or obligation to send a message.</p>
              <p>Life gets busy, contact drifts and keeping in touch gets harder.</p>
              <p>NUJ removes that barrier by making it easy to acknowledge each other regularly, even when nothing needs to be said.</p>

              <div>
                <p className="font-medium text-foreground mb-2"><strong>How it works</strong></p>
                <div className="space-y-3">
                  <p><strong>Add mates</strong> – Share your NUJ code (in your profile) with friends, or enter theirs to connect.</p>
                  <p><strong>Groups</strong> – Create groups to keep track of your mates.</p>
                  <p><strong>Check in</strong> – Tap once to say “you’re around”. It takes a second. Nothing more needed. Set a reminder so you don’t forget.</p>
                  <p><strong>See who’s around</strong> – See when your mates last checked in.</p>
                  <p><strong>Gentle nudges</strong> – If someone’s been quiet, send a small NUJ to let them know you’re thinking of them.</p>
                  <p><strong>Meet-ups (coming soon)</strong> – Check in together regularly to unlock deals on real-world activities. A chance to catch up and spend time together. Win-win.</p>
                </div>
              </div>

              <p className="text-foreground text-center"><strong>Stay connected</strong></p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Auth;
