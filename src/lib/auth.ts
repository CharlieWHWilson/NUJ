
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}


interface StoredAuthUser extends AuthUser {
  password: string;
}

const USERS_STORAGE_KEY = "nuj.auth.users";
const SESSION_STORAGE_KEY = "nuj.auth.session";

export const loadUsers = (): StoredAuthUser[] => {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = localStorage.getItem(USERS_STORAGE_KEY);
    if (!rawValue) return [];

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue.filter((value): value is StoredAuthUser => {
      if (!value || typeof value !== "object") return false;
      const user = value as Partial<StoredAuthUser>;
      return (
        typeof user.id === "string"
        && typeof user.name === "string"
        && typeof user.email === "string"
        && typeof user.phone === "string"
        && typeof user.password === "string"
      );
    });
  } catch {
    return [];
  }
};

const saveUsers = (users: StoredAuthUser[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const saveSession = (user: AuthUser) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
};

function generateUserId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

export const registerUser = (input: { name: string; email: string; phone: string; password: string }) => {
  const users = loadUsers();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    return { ok: false as const, message: "An account with this email already exists." };
  }

  const createdUser: StoredAuthUser = {
    id: generateUserId(),
    name: input.name.trim(),
    email: normalizedEmail,
    phone: input.phone.trim(),
    password: input.password,
  };

  saveUsers([...users, createdUser]);
  saveSession({ id: createdUser.id, name: createdUser.name, email: createdUser.email, phone: createdUser.phone });

  return { ok: true as const };
};

export const loginUser = (input: { email: string; password: string }) => {
  const users = loadUsers();
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUser = users.find(
    (user) => user.email.toLowerCase() === normalizedEmail && user.password === input.password,
  );

  if (!existingUser) {
    return { ok: false as const, message: "Invalid email or password." };
  }


  saveSession({
    id: existingUser.id,
    name: existingUser.name,
    email: existingUser.email,
    phone: existingUser.phone,
  });

  return { ok: true as const };
};

export const getCurrentUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawValue) return null;

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") return null;

    const user = parsedValue as Partial<AuthUser>;
    if (
      typeof user.id !== "string" ||
      typeof user.name !== "string" ||
      typeof user.email !== "string" ||
      typeof user.phone !== "string"
    ) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};

export const logoutUser = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
};
