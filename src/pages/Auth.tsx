import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { registerUser, loginUser } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AuthMode = "login" | "register";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [errorMessage, setErrorMessage] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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

    if (registerPassword !== registerConfirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await registerUser({
      name: registerName,
      email: registerEmail,
      phone: registerPhone,
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
    <div className="min-h-screen bg-background max-w-md mx-auto px-5 pt-16 pb-16">
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
            }}
            className={`h-10 rounded-xl text-sm font-medium transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setMode("register");
              setErrorMessage("");
            }}
            className={`h-10 rounded-xl text-sm font-medium transition-colors ${mode === "register" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Register
          </button>
        </div>

        {errorMessage && (
          <p className="text-sm text-destructive mb-4">{errorMessage}</p>
        )}

        {successMessage && (
          <p className="text-sm text-success mb-4">{successMessage}</p>
        )}

        {mode === "login" ? (
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
              type="tel"
              placeholder="Phone"
              value={registerPhone}
              onChange={(event) => setRegisterPhone(event.target.value)}
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
              </DialogContent>
            </Dialog>

            <DialogHeader>
              <DialogTitle>What is NUJ?</DialogTitle>
            </DialogHeader>

            <div className="text-sm text-muted-foreground space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <p>NUJ is the easy way to stay connected with mates. No pressure, guilt or long messages.</p>
              <p>Life gets busy, contact drifts and keeping in touch can feel harder than it should.</p>
              <p>NUJ removes that barrier by making it easy to acknowledge each other regularly even when nothing specific is said.</p>

              <div>
                <p className="font-medium text-foreground mb-2">How it works</p>
                <div className="space-y-3">
                  <p><strong>Check in</strong> – Tap once to say “you’re around.” No typing, no explanation, it takes a second. Nothing more needed, you’re ‘around’.</p>
                  <p><strong>See who’s around</strong> – Your mates’ last check-ins are visible: today, yesterday, or a few days ago. Quiet awareness, nothing more.</p>
                  <p><strong>Gentle nudges</strong> – If someone’s been quiet, send a small NUJ to show you’re thinking of them.</p>
                  <p className="text-muted-foreground/60"><strong>Meet-ups (coming soon)</strong> – Check in together regularly enough and you can unlock deals for real-world activities. A chance to catch up and spend time together (win/win).</p>
                </div>
              </div>

              <p className="text-foreground text-center">Just a simple way to stay connected.</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Auth;
