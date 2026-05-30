'use client';

import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignOutButton,
  SignUpButton,
  useUser,
} from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import {
  ArrowLeft,
  CalendarDays,
  CircleUserRound,
  Home,
  Loader2,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';

import { api, errorMessage } from '@/lib/api';
import { displayName, formatMoney, formatPartyDate } from '@/lib/format';
import { configureNativeShell, impact } from '@/lib/native';
import type { MeProfile, PartyDetail, PartySummary } from '@/types/domain';

type AppView = 'discover' | 'event' | 'checkout' | 'tickets' | 'profile';
type Notice = { tone: 'success' | 'error' | 'info'; message: string };

type ProfileForm = {
  displayName: string;
  bio: string;
  school: string;
};

const emptyProfileForm: ProfileForm = {
  displayName: '',
  bio: '',
  school: '',
};

export function PartyLinkApp() {
  useEffect(() => {
    void configureNativeShell();
  }, []);

  return (
    <>
      <SignedOut>
        <AuthScreen />
      </SignedOut>
      <SignedIn>
        <TicketingApp />
      </SignedIn>
    </>
  );
}

function TicketingApp() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  const [history, setHistory] = useState<AppView[]>(['discover']);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState('');
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const view = history[history.length - 1] ?? 'discover';

  const partiesQuery = useQuery({ queryKey: ['parties'], queryFn: api.listParties });
  const meQuery = useQuery({ queryKey: ['me', userId], queryFn: () => api.getMe(userId), enabled: Boolean(userId) });
  const ticketsQuery = useQuery({
    queryKey: ['tickets', userId],
    queryFn: () => api.getAttending(userId),
    enabled: Boolean(userId),
  });
  const partyQuery = useQuery({
    queryKey: ['party', selectedPartyId, userId],
    queryFn: () => api.getParty(userId, selectedPartyId!),
    enabled: Boolean(selectedPartyId && userId),
  });

  const ticketedPartyIds = useMemo(
    () => new Set((ticketsQuery.data ?? []).map((ticket) => ticket.party_id)),
    [ticketsQuery.data],
  );

  const filteredParties = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const parties = partiesQuery.data ?? [];
    if (!normalized) return parties;

    return parties.filter((party) =>
      [party.name, party.location, party.location_meta?.address]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [partiesQuery.data, search]);

  useEffect(() => {
    if (!meQuery.data || !user) return;
    setProfileForm({
      displayName: meQuery.data.display_name ?? user.fullName ?? user.username ?? '',
      bio: meQuery.data.bio ?? '',
      school: meQuery.data.school ?? '',
    });
  }, [meQuery.data, user]);

  const showNotice = (next: Notice) => {
    setNotice(next);
    window.setTimeout(() => setNotice(null), 3200);
  };

  const navigate = (next: AppView, options?: { replace?: boolean }) => {
    void impact();
    setHistory((previous) => {
      const current = previous[previous.length - 1];
      if (options?.replace) return current === next ? previous : [...previous.slice(0, -1), next];
      return current === next ? previous : [...previous, next];
    });
  };

  const goBack = () => {
    void impact();
    setHistory((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous));
  };

  const openParty = (partyId: string) => {
    setSelectedPartyId(partyId);
    navigate('event');
  };

  const attendMutation = useMutation({
    mutationFn: () => api.attendParty(userId, selectedPartyId!),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['parties'] }),
        queryClient.invalidateQueries({ queryKey: ['party', selectedPartyId, userId] }),
        queryClient.invalidateQueries({ queryKey: ['tickets', userId] }),
      ]);
      showNotice({ tone: 'success', message: result.alreadyAttending ? 'Ticket already saved.' : 'Ticket saved.' });
      navigate('tickets', { replace: true });
    },
    onError: (error) => showNotice({ tone: 'error', message: errorMessage(error) }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      api.updateMe(userId, {
        displayName: profileForm.displayName.trim(),
        bio: profileForm.bio.trim(),
        school: profileForm.school.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', userId] });
      showNotice({ tone: 'success', message: 'Profile saved.' });
    },
    onError: (error) => showNotice({ tone: 'error', message: errorMessage(error) }),
  });

  const uploadProfilePictureMutation = useMutation({
    mutationFn: (file: File) => api.uploadProfilePicture(userId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', userId] });
      showNotice({ tone: 'success', message: 'Profile photo updated.' });
    },
    onError: (error) => showNotice({ tone: 'error', message: errorMessage(error) }),
  });

  if (!isLoaded || !userId) {
    return <LoadingScreen label="Loading your tickets" />;
  }

  return (
    <section className="min-h-dvh bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-stone-50 text-zinc-950 shadow-2xl">
        {notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}

        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-[max(16px,env(safe-area-inset-top))]">
          {view === 'discover' ? (
            <DiscoverScreen
              parties={filteredParties}
              loading={partiesQuery.isLoading}
              error={partiesQuery.error}
              search={search}
              ticketedPartyIds={ticketedPartyIds}
              ticketCount={ticketsQuery.data?.length ?? 0}
              onSearch={setSearch}
              onOpenParty={openParty}
              onOpenProfile={() => navigate('profile')}
            />
          ) : null}

          {view === 'event' ? (
            <EventScreen
              party={partyQuery.data ?? null}
              loading={partyQuery.isLoading}
              error={partyQuery.error}
              hasTicket={selectedPartyId ? ticketedPartyIds.has(selectedPartyId) : false}
              onBack={goBack}
              onCheckout={() => navigate('checkout')}
              onTickets={() => navigate('tickets')}
            />
          ) : null}

          {view === 'checkout' ? (
            <CheckoutScreen
              party={partyQuery.data ?? null}
              busy={attendMutation.isPending}
              onBack={goBack}
              onConfirm={() => attendMutation.mutate()}
            />
          ) : null}

          {view === 'tickets' ? (
            <TicketsScreen
              tickets={ticketsQuery.data ?? []}
              loading={ticketsQuery.isLoading}
              onOpenParty={openParty}
            />
          ) : null}

          {view === 'profile' ? (
            <ProfileScreen
              me={meQuery.data}
              form={profileForm}
              ticketCount={ticketsQuery.data?.length ?? 0}
              busy={updateProfileMutation.isPending || uploadProfilePictureMutation.isPending}
              onBack={goBack}
              onForm={setProfileForm}
              onProfilePicture={(file) => uploadProfilePictureMutation.mutate(file)}
              onSave={() => updateProfileMutation.mutate()}
            />
          ) : null}
        </main>

        <BottomNav active={view} onNavigate={(next) => navigate(next, { replace: true })} />
      </div>
    </section>
  );
}

function AuthScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-950 px-5 text-white">
      <section className="grid w-full max-w-[420px] gap-8">
        <div className="grid gap-5">
          <Image src="/icon.png" alt="" width={80} height={80} className="h-20 w-20 rounded-lg shadow-2xl" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">PartyLink</p>
            <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-normal">Tickets for the next loud night.</h1>
            <p className="mt-4 text-base leading-6 text-zinc-300">
              Discover concerts, parties, and nightlife events. Buy once, show your ticket at the door.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <SignInButton mode="modal">
            <button className="flex h-14 items-center justify-center gap-2 rounded-lg bg-white font-black text-neutral-950" type="button">
              <Lock size={18} />
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="flex h-14 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 font-black text-white" type="button">
              <Sparkles size={18} />
              Create account
            </button>
          </SignUpButton>
        </div>
      </section>
    </main>
  );
}

function DiscoverScreen({
  parties,
  loading,
  error,
  search,
  ticketedPartyIds,
  ticketCount,
  onSearch,
  onOpenParty,
  onOpenProfile,
}: {
  parties: PartySummary[];
  loading: boolean;
  error: unknown;
  search: string;
  ticketedPartyIds: Set<string>;
  ticketCount: number;
  onSearch: (value: string) => void;
  onOpenParty: (partyId: string) => void;
  onOpenProfile: () => void;
}) {
  return (
    <div className="grid gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">PartyLink</p>
          <h1 className="text-3xl font-black tracking-normal">Upcoming events</h1>
        </div>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-lg bg-zinc-950 text-white"
          onClick={onOpenProfile}
          aria-label="Open profile"
        >
          <CircleUserRound size={22} />
        </button>
      </header>



      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={19} />
        <input
          className="h-12 rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-zinc-950 outline-none focus:border-zinc-950"
          placeholder="Search by artist, venue, or city"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>

      <LoadState loading={loading} error={error} empty={!parties.length} emptyLabel="No events match your search." />

      <div className="grid gap-3">
        {parties.map((party) => (
          <EventCard
            key={party.party_id}
            party={party}
            hasTicket={ticketedPartyIds.has(party.party_id)}
            onOpen={() => onOpenParty(party.party_id)}
          />
        ))}
      </div>
    </div>
  );
}

function EventCard({ party, hasTicket, onOpen }: { party: PartySummary; hasTicket: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="grid overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm"
      onClick={onOpen}
    >
      <EventImage party={party} />
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black">{party.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-sm text-zinc-600">
              <CalendarDays size={15} />
              {formatPartyDate(party.party_date, party.party_time)}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-sm font-black">{formatMoney(party.price)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-zinc-600">
            <MapPin className="mr-1 inline" size={15} />
            {party.location}
          </p>
          <span className={hasTicket ? 'text-sm font-black text-emerald-700' : 'text-sm font-black text-rose-600'}>
            {hasTicket ? 'Ticket saved' : `${party.tickets_left} left`}
          </span>
        </div>
      </div>
    </button>
  );
}

function EventScreen({
  party,
  loading,
  error,
  hasTicket,
  onBack,
  onCheckout,
  onTickets,
}: {
  party: PartyDetail | null;
  loading: boolean;
  error: unknown;
  hasTicket: boolean;
  onBack: () => void;
  onCheckout: () => void;
  onTickets: () => void;
}) {
  return (
    <div className="grid gap-4">
      <ScreenHeader title="Event" onBack={onBack} />
      <LoadState loading={loading} error={error} empty={!party} emptyLabel="Event not found." />
      {party ? (
        <>
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <EventImage party={party} tall />
            <div className="grid gap-4 p-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Live event</p>
                <h1 className="mt-1 text-3xl font-black tracking-normal">{party.name}</h1>
              </div>
              <InfoRow icon={<CalendarDays size={18} />} label={formatPartyDate(party.party_date, party.party_time)} />
              <InfoRow icon={<MapPin size={18} />} label={party.location_meta?.address ?? party.location} />
              {party.description ? <p className="text-sm leading-6 text-zinc-700">{party.description}</p> : null}
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Price" value={formatMoney(party.price)} />
                <Stat label="Tickets left" value={String(party.tickets_left)} />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="flex h-14 items-center justify-center gap-2 rounded-lg bg-zinc-950 font-black text-white"
            onClick={hasTicket ? onTickets : onCheckout}
          >
            <Ticket size={19} />
            {hasTicket ? 'View ticket' : 'Get ticket'}
          </button>
        </>
      ) : null}
    </div>
  );
}

function CheckoutScreen({
  party,
  busy,
  onBack,
  onConfirm,
}: {
  party: PartyDetail | null;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      <ScreenHeader title="Checkout" onBack={onBack} />
      {party ? (
        <section className="grid gap-4 rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">{party.name}</h1>
              <p className="mt-1 text-sm text-zinc-600">{formatPartyDate(party.party_date, party.party_time)}</p>
            </div>
            <span className="rounded-md bg-zinc-100 px-3 py-2 font-black">{formatMoney(party.price)}</span>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4">
            <div className="flex items-center gap-2 font-black">
              <ShieldCheck size={19} className="text-emerald-700" />
              Secure ticket claim
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Your ticket is tied to your authenticated PartyLink account and includes a unique entry code.
            </p>
          </div>

          <button
            className="flex h-14 items-center justify-center gap-2 rounded-lg bg-zinc-950 font-black text-white"
            type="submit"
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" size={19} /> : <Ticket size={19} />}
            Confirm ticket
          </button>
        </section>
      ) : (
        <LoadState loading={false} error={null} empty emptyLabel="Choose an event before checkout." />
      )}
    </form>
  );
}

function TicketsScreen({
  tickets,
  loading,
  onOpenParty,
}: {
  tickets: PartySummary[];
  loading: boolean;
  onOpenParty: (partyId: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Wallet</p>
        <h1 className="text-3xl font-black tracking-normal">Your tickets</h1>
      </header>
      <LoadState loading={loading} error={null} empty={!tickets.length} emptyLabel="No tickets yet. Find an event to get started." />
      <div className="grid gap-3">
        {tickets.map((ticket) => (
          <button
            key={ticket.party_id}
            type="button"
            className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-sm"
            onClick={() => onOpenParty(ticket.party_id)}
          >
            <div className="flex gap-4">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-white p-2">
                <QRCode value={ticket.ticket_code ?? ticket.party_id} size={80} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-black">{ticket.name}</h2>
                <p className="mt-1 text-sm text-zinc-600">{formatPartyDate(ticket.party_date, ticket.party_time)}</p>
                <p className="mt-1 truncate text-sm text-zinc-600">{ticket.location}</p>
              </div>
            </div>
            <div className="rounded-md bg-zinc-100 px-3 py-2 font-mono text-sm font-black">
              {ticket.ticket_code ?? 'Code pending'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileScreen({
  me,
  form,
  ticketCount,
  busy,
  onBack,
  onForm,
  onProfilePicture,
  onSave,
}: {
  me: MeProfile | undefined;
  form: ProfileForm;
  ticketCount: number;
  busy: boolean;
  onBack: () => void;
  onForm: (form: ProfileForm) => void;
  onProfilePicture: (file: File) => void;
  onSave: () => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  const handlePicture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onProfilePicture(file);
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <ScreenHeader title="Profile" onBack={onBack} />
      <section className="grid gap-4 rounded-lg bg-white p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <label className="relative grid h-20 w-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg bg-zinc-100">
            {me?.has_profile_picture ? (
              <Image src={api.profilePicture(me.id)} alt="" width={80} height={80} className="h-full w-full object-cover" />
            ) : (
              <UserRound size={30} className="text-zinc-500" />
            )}
            <input className="sr-only" type="file" accept="image/*" onChange={handlePicture} />
          </label>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black">{displayName(me)}</h1>
            <p className="mt-1 text-sm text-zinc-600">{ticketCount} saved tickets</p>
          </div>
        </div>

        <label className="grid gap-2 text-sm font-bold">
          Display name
          <input
            className="h-12 rounded-lg border border-zinc-200 bg-white px-3 text-zinc-950"
            value={form.displayName}
            onChange={(event) => onForm({ ...form, displayName: event.target.value })}
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Bio
          <textarea
            className="min-h-24 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-zinc-950"
            value={form.bio}
            onChange={(event) => onForm({ ...form, bio: event.target.value })}
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          City or school
          <input
            className="h-12 rounded-lg border border-zinc-200 bg-white px-3 text-zinc-950"
            value={form.school}
            onChange={(event) => onForm({ ...form, school: event.target.value })}
          />
        </label>

        <button
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-zinc-950 py-4 font-black text-white"
          type="submit"
          disabled={busy}
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : null}
          Save profile
        </button>
      </section>
      <SignOutButton>
        <button className="h-12 rounded-lg border border-zinc-300 bg-transparent font-black text-zinc-700" type="button">
          Sign out
        </button>
      </SignOutButton>
    </form>
  );
}

function BottomNav({ active, onNavigate }: { active: AppView; onNavigate: (view: AppView) => void }) {
  const items: Array<{ view: AppView; label: string; icon: typeof Home }> = [
    { view: 'discover', label: 'Home', icon: Home },
    { view: 'tickets', label: 'Tickets', icon: Ticket },
    { view: 'profile', label: 'Profile', icon: CircleUserRound },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[480px] border-t border-zinc-200 bg-white/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.view || (active === 'checkout' && item.view === 'tickets');
          return (
            <button
              key={item.view}
              type="button"
              className={`grid min-h-14 place-items-center gap-1 rounded-lg text-xs font-black ${
                selected ? 'bg-zinc-950 text-white' : 'text-zinc-500'
              }`}
              onClick={() => onNavigate(item.view)}
            >
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="grid grid-cols-[44px_1fr_44px] items-center">
      <button type="button" className="grid h-11 w-11 place-items-center rounded-lg bg-white" onClick={onBack} aria-label="Go back">
        <ArrowLeft size={20} />
      </button>
      <h1 className="text-center text-lg font-black">{title}</h1>
    </header>
  );
}

function EventImage({ party, tall = false }: { party: PartySummary; tall?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-zinc-200 ${tall ? 'aspect-[5/4]' : 'aspect-[16/9]'}`}>
      <Image src={api.partyBanner(party.party_id)} alt="" fill sizes="480px" className="object-cover" />
      <div className="absolute left-3 top-3 rounded-md bg-white px-2 py-1 text-xs font-black text-zinc-950">
        {formatMoney(party.price)}
      </div>
    </div>
  );
}

function InfoRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-3 text-sm text-zinc-700">
      <span className="mt-0.5 text-zinc-950">{icon}</span>
      <span className="leading-6">{label}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-100 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const toneClass =
    notice.tone === 'error' ? 'bg-rose-600' : notice.tone === 'success' ? 'bg-emerald-700' : 'bg-zinc-950';

  return (
    <button
      type="button"
      className={`fixed left-1/2 top-4 z-20 w-[min(92vw,440px)] -translate-x-1/2 rounded-lg px-4 py-3 text-left text-sm font-bold text-white shadow-xl ${toneClass}`}
      onClick={onDismiss}
    >
      {notice.message}
    </button>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-950 text-white">
      <div className="flex items-center gap-3 font-black">
        <Loader2 className="animate-spin" size={22} />
        {label}
      </div>
    </main>
  );
}

function LoadState({
  loading,
  error,
  empty,
  emptyLabel,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-white p-4 text-sm font-bold text-zinc-600">
        <Loader2 className="animate-spin" size={18} />
        Loading
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-rose-50 p-4 text-sm font-bold text-rose-700">{errorMessage(error)}</div>;
  }

  if (empty) {
    return <div className="rounded-lg bg-white p-4 text-sm font-bold text-zinc-600">{emptyLabel}</div>;
  }

  return null;
}
