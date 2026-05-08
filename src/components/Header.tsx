import { Link, useRouter } from "@tanstack/react-router";
import { Coins, LogOut, Shield, Swords, Trophy, User as UserIcon, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-black tracking-tight">
          <Swords className="size-6 text-primary" />
          <span className="text-lg uppercase">
            Gang<span className="text-primary">Bet</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/matches" icon={<Swords className="size-4" />}>Matches</NavLink>
          <NavLink to="/gangs" icon={<Users className="size-4" />}>Gangs</NavLink>
          <NavLink to="/leaderboard" icon={<Trophy className="size-4" />}>Leaderboard</NavLink>
          {isAdmin && <NavLink to="/admin" icon={<Shield className="size-4" />}>Admin</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          {user && profile ? (
            <>
              <div className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary sm:flex">
                <Coins className="size-4" />
                {profile.coins.toLocaleString()}
              </div>
              <Link to="/profile">
                <Button variant="ghost" size="sm" className="gap-2">
                  <UserIcon className="size-4" />
                  <span className="hidden sm:inline">{profile.username}</span>
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={async () => { await signOut(); router.navigate({ to: "/" }); }}>
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="font-bold uppercase">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      activeProps={{ className: "text-primary bg-primary/10" }}
    >
      {icon}
      {children}
    </Link>
  );
}