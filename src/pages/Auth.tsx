import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { getRegistrationNameError, registerUser, loginUser, requestPasswordReset } from "@/lib/auth";
import { WhatIsNujDialog } from "@/components/WhatIsNujDialog";

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

      <div className="mt-4 flex items-center justify-center gap-3">
        <WhatIsNujDialog trigger={
            <button type="button" className="inline-flex items-center justify-center rounded-full border border-muted-foreground/40 px-5 py-3 text-base font-medium text-muted-foreground shadow-sm transition-colors hover:border-foreground/30 hover:text-foreground">
              What is NUJ?
            </button>
        } />
      </div>
    </div>
  );
};

export default Auth;
