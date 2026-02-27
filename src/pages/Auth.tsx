import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { registerUser, loginUser } from "@/lib/auth";

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

  const submitLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const result = loginUser({
      email: loginEmail,
      password: loginPassword,
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    navigate("/");
  };

  const submitRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (registerPassword !== registerConfirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    const result = registerUser({
      name: registerName,
      email: registerEmail,
      phone: registerPhone,
      password: registerPassword,
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto px-5 pt-16 pb-16">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">NUJ</h1>
        <p className="text-sm text-muted-foreground mt-2">Sign in or create your account</p>
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
    </div>
  );
};

export default Auth;
