import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, Search, Eye, Edit, CreditCard } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/members/")({
  head: () => ({
    meta: [
      { title: "Members — ChurchFlow" },
      { name: "description", content: "Manage church members" },
    ],
  }),
  component: MembersPage,
});

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  paymentType: "card" | "cash";
  status: "active" | "inactive";
}

const mockMembers: Member[] = [
  { id: "1", name: "Sarah Johnson", email: "sarah@email.com", phone: "(555) 123-4567", paymentType: "card", status: "active" },
  { id: "2", name: "Michael Williams", email: "michael@email.com", phone: "(555) 234-5678", paymentType: "cash", status: "active" },
  { id: "3", name: "Emily Davis", email: "emily@email.com", phone: "(555) 345-6789", paymentType: "card", status: "active" },
  { id: "4", name: "James Brown", email: "james@email.com", phone: "(555) 456-7890", paymentType: "cash", status: "inactive" },
  { id: "5", name: "Olivia Martinez", email: "olivia@email.com", phone: "(555) 567-8901", paymentType: "card", status: "active" },
  { id: "6", name: "Daniel Anderson", email: "daniel@email.com", phone: "(555) 678-9012", paymentType: "card", status: "active" },
  { id: "7", name: "Sophia Thomas", email: "sophia@email.com", phone: "(555) 789-0123", paymentType: "cash", status: "active" },
  { id: "8", name: "David Wilson", email: "david@email.com", phone: "(555) 890-1234", paymentType: "card", status: "inactive" },
];

function MembersPage() {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = mockMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-google inline-flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add Member
        </button>
      </div>

      {/* Table */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="table-header px-5 py-3 text-left">Name</th>
                <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Email</th>
                <th className="table-header px-5 py-3 text-left hidden md:table-cell">Phone</th>
                <th className="table-header px-5 py-3 text-left">Payment</th>
                <th className="table-header px-5 py-3 text-left">Status</th>
                <th className="table-header px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                        {member.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span className="text-sm font-medium text-foreground">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground hidden sm:table-cell">
                    {member.email}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground hidden md:table-cell">
                    {member.phone}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground capitalize">
                      {member.paymentType === "card" ? (
                        <CreditCard className="h-3.5 w-3.5" />
                      ) : (
                        <span className="text-xs">💵</span>
                      )}
                      {member.paymentType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`status-badge ${
                        member.status === "active" ? "status-active" : "status-inactive"
                      }`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to="/members/$memberId"
                        params={{ memberId: member.id }}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

function AddMemberModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-md p-6">
        <h2 className="font-display text-lg font-semibold text-foreground mb-5">Add New Member</h2>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
            <input
              type="text"
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
            <input
              type="tel"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="(555) 000-0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Payment Method</label>
            <select className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="card">Card</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" className="btn-google flex-1">
              Save Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
