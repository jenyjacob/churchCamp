import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const EXPENSE_CATEGORIES = ["Catering", "Lodging", "Transportation", "Activities", "Supplies", "Other"];

export default function FinancePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("fees");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Stats State
  const [stats, setStats] = useState({
    total_expenses: 0,
    total_expected_fees: 0,
    total_collected_fees: 0,
    net_balance: 0
  });

  // Families State
  const [families, setFamilies] = useState([]);
  const [familySearch, setFamilySearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all"); // all, unpaid, partial, paid
  const [expandedFamilies, setExpandedFamilies] = useState({});

  // Expenses State
  const [expenses, setExpenses] = useState([]);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("All");

  // Fee Rates Pricing Config State
  const [rates, setRates] = useState([]);
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [ratesForm, setRatesForm] = useState([]);

  // Modals State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [activeExpense, setActiveExpense] = useState(null); // null means new, otherwise expense object
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    category: "Catering",
    amount: "",
    date: new Date().toISOString().split("T")[0]
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeFamily, setActiveFamily] = useState(null); // family object
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: "",
    status: "unpaid",
    notes: ""
  });

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  };

  const flashError = (msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  };

  // Fetch Data
  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const [statsRes, feesRes, expensesRes, ratesRes] = await Promise.all([
        api.get("/api/finance/stats"),
        api.get("/api/finance/fees"),
        api.get("/api/finance/expenses"),
        api.get("/api/finance/rates")
      ]);
      setStats(statsRes.data);
      setFamilies(feesRes.data.families);
      setExpenses(expensesRes.data.expenses);
      setRates(ratesRes.data.rates);
    } catch (err) {
      flashError(err.response?.data?.error || "Failed to load financial records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expand / Collapse Family Detail
  const toggleFamilyExpand = (familyGroup) => {
    setExpandedFamilies(prev => ({
      ...prev,
      [familyGroup]: !prev[familyGroup]
    }));
  };

  // Expense CRUD
  const handleOpenExpenseModal = (expense = null) => {
    if (expense) {
      setActiveExpense(expense);
      setExpenseForm({
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        date: expense.date
      });
    } else {
      setActiveExpense(null);
      setExpenseForm({
        description: "",
        category: "Catering",
        amount: "",
        date: new Date().toISOString().split("T")[0]
      });
    }
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setError("");
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.date) {
      setError("Please fill out all required fields.");
      return;
    }

    try {
      if (activeExpense) {
        // Update
        await api.put(`/api/finance/expenses/${activeExpense.id}`, expenseForm);
        flashSuccess("Expense updated successfully!");
      } else {
        // Create
        await api.post("/api/finance/expenses", expenseForm);
        flashSuccess("Expense added successfully!");
      }
      setIsExpenseModalOpen(false);
      fetchFinanceData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save expense.");
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Are you sure you want to permanently delete this expense?")) return;
    try {
      await api.delete(`/api/finance/expenses/${expenseId}`);
      flashSuccess("Expense deleted successfully!");
      fetchFinanceData();
    } catch (err) {
      flashError(err.response?.data?.error || "Failed to delete expense.");
    }
  };

  // Payment CRUD
  const handleOpenPaymentModal = (family) => {
    setActiveFamily(family);
    setPaymentForm({
      amount_paid: family.amount_paid,
      status: family.status,
      notes: family.notes || "",
      override_fee: family.override_fee !== null ? family.override_fee : ""
    });
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/finance/fees", {
        family_group: activeFamily.family_group,
        amount_paid: paymentForm.amount_paid,
        status: paymentForm.status,
        notes: paymentForm.notes,
        override_fee: paymentForm.override_fee !== "" ? paymentForm.override_fee : null
      });
      flashSuccess(`Payment details for '${activeFamily.display_name}' saved!`);
      setIsPaymentModalOpen(false);
      fetchFinanceData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to record payment details.");
    }
  };

  // Rates Pricing Configuration handlers
  const handleOpenRatesModal = () => {
    setRatesForm(rates.map(r => ({ ...r })));
    setIsRatesModalOpen(true);
  };

  const handleRateFormChange = (index, value) => {
    setRatesForm(prev => {
      const copy = [...prev];
      copy[index].price = value;
      return copy;
    });
  };

  const handleSaveRates = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/finance/rates", { rates: ratesForm });
      flashSuccess("Fee tier pricing rates saved successfully!");
      setIsRatesModalOpen(false);
      fetchFinanceData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save fee pricing rates.");
    }
  };

  // Filters
  const filteredFamilies = families.filter(f => {
    const matchesSearch = f.display_name.toLowerCase().includes(familySearch.toLowerCase()) || 
      f.members.some(m => m.full_name.toLowerCase().includes(familySearch.toLowerCase()));
    const matchesStatus = familyFilter === "all" || f.status === familyFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.category.toLowerCase().includes(expenseSearch.toLowerCase());
    const matchesCategory = expenseCategoryFilter === "All" || e.category === expenseCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container" style={{ padding: "20px 0" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 600 }}>💰 Finance Manager</h1>
          <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Track itemized camp expenses and collection of tiered family registration fees.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {activeTab === "fees" && (
            <button className="btn btn-secondary" onClick={handleOpenRatesModal}>
              ⚙️ Configure Pricing
            </button>
          )}
          {activeTab === "expenses" && (
            <button className="btn btn-primary" onClick={() => handleOpenExpenseModal()}>
              ➕ Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Error & Success banners */}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ {success}</div>}

      {/* Summary KPI Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
        marginBottom: 24
      }}>
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", borderLeft: "4px solid var(--primary)" }}>
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600 }}>Expected Fees</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, margin: "8px 0" }}>${stats.total_expected_fees.toFixed(2)}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Assessed from registered campers</span>
        </div>
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", borderLeft: "4px solid #2ecc71" }}>
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600 }}>Collected Fees</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, margin: "8px 0", color: "#2ecc71" }}>${stats.total_collected_fees.toFixed(2)}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            {stats.total_expected_fees > 0 
              ? `${((stats.total_collected_fees / stats.total_expected_fees) * 100).toFixed(1)}% of expectation` 
              : "0% of expectation"}
          </span>
        </div>
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", borderLeft: "4px solid var(--danger)" }}>
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600 }}>Total Expenses</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, margin: "8px 0", color: "var(--danger)" }}>${stats.total_expenses.toFixed(2)}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Outflow items registered</span>
        </div>
        <div className="card" style={{ 
          padding: 16, 
          display: "flex", 
          flexDirection: "column", 
          borderLeft: `4px solid ${stats.net_balance >= 0 ? "#3498db" : "var(--danger)"}` 
        }}>
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600 }}>Net Balance</span>
          <span style={{ 
            fontSize: "1.5rem", 
            fontWeight: 700, 
            margin: "8px 0", 
            color: stats.net_balance >= 0 ? "#3498db" : "var(--danger)" 
          }}>${stats.net_balance.toFixed(2)}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Collected Fees minus Expenses</span>
        </div>
      </div>

      {/* Premium Segmented Card Tabs */}
      <div style={{ 
        display: "flex", 
        gap: "12px", 
        marginBottom: "24px",
        flexWrap: "wrap"
      }}>
        <button 
          style={{
            padding: "12px 20px",
            background: activeTab === "fees" ? "#ffffff" : "rgba(0,0,0,0.02)",
            border: activeTab === "fees" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
            borderRadius: "10px",
            color: activeTab === "fees" ? "var(--primary)" : "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: activeTab === "fees" ? "0 4px 12px rgba(30, 77, 43, 0.06)" : "none",
            transform: activeTab === "fees" ? "translateY(-1px)" : "none",
            transition: "all 0.2s ease"
          }}
          onClick={() => setActiveTab("fees")}
        >
          <span style={{ fontSize: "1.25rem" }}>🏷️</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", lineHeight: "1.2" }}>Family Camp Fees</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400, marginTop: 2 }}>Track Collections</div>
          </div>
        </button>
        <button 
          style={{
            padding: "12px 20px",
            background: activeTab === "expenses" ? "#ffffff" : "rgba(0,0,0,0.02)",
            border: activeTab === "expenses" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
            borderRadius: "10px",
            color: activeTab === "expenses" ? "var(--primary)" : "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: activeTab === "expenses" ? "0 4px 12px rgba(30, 77, 43, 0.06)" : "none",
            transform: activeTab === "expenses" ? "translateY(-1px)" : "none",
            transition: "all 0.2s ease"
          }}
          onClick={() => setActiveTab("expenses")}
        >
          <span style={{ fontSize: "1.25rem" }}>🧾</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", lineHeight: "1.2" }}>Itemized Expenses</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400, marginTop: 2 }}>Track Outflow</div>
          </div>
        </button>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)" }}>Loading finance records...</div>}

      {!loading && activeTab === "fees" && (
        <div>
          {/* Family Filters Panel */}
          <div className="card" style={{ padding: 12, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search family group or camper name..." 
              value={familySearch} 
              onChange={e => setFamilySearch(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <select 
              className="form-input" 
              value={familyFilter} 
              onChange={e => setFamilyFilter(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="all">All Payment Statuses</option>
              <option value="unpaid">❌ Unpaid</option>
              <option value="partial">⚠️ Partial Paid</option>
              <option value="paid">✅ Fully Paid</option>
            </select>
          </div>

          {/* Families Table */}
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: "30px" }}></th>
                  <th>Family Group</th>
                  <th>Eligible Members (Age ≥ 5 or Null)</th>
                  <th>Assessed Fee</th>
                  <th>Amount Paid</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFamilies.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)" }}>
                      No matching family fee records found.
                    </td>
                  </tr>
                ) : (
                  filteredFamilies.map(f => {
                    const isExpanded = !!expandedFamilies[f.family_group];
                    return (
                      <React.Fragment key={f.family_group}>
                        <tr style={{ borderBottom: isExpanded ? "none" : "1px solid var(--border-color)" }}>
                          <td>
                            <button 
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", padding: 4 }} 
                              onClick={() => toggleFamilyExpand(f.family_group)}
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                          </td>
                          <td>
                            <strong style={{ display: "block" }}>{f.display_name}</strong>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                              {f.members.length} {f.members.length === 1 ? "member" : "members"} total
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{f.eligible_count}</span>
                            {f.members.length - f.eligible_count > 0 && (
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: 6 }}>
                                (Excluded: {f.members.length - f.eligible_count} under age 5)
                              </span>
                            )}
                          </td>
                          <td>
                            {f.is_overridden ? (
                              <div>
                                <strong style={{ color: "#e67e22" }}>${f.calculated_fee.toFixed(2)}</strong>
                                <span style={{ 
                                  display: "block", 
                                  fontSize: "0.675rem", 
                                  color: "var(--text-secondary)", 
                                  textDecoration: "line-through" 
                                }}>
                                  Tier: ${f.tiered_fee.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <strong>${f.calculated_fee.toFixed(2)}</strong>
                            )}
                          </td>
                          <td style={{ color: f.amount_paid > 0 ? "#2ecc71" : "inherit" }}>
                            <strong>${f.amount_paid.toFixed(2)}</strong>
                          </td>
                          <td>
                            <span className={`badge ${
                              f.status === "paid" ? "badge-success" : f.status === "partial" ? "badge-warning" : "badge-danger"
                            }`}>
                              {f.status === "paid" ? "Fully Paid" : f.status === "partial" ? "Partial" : "Unpaid"}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.825rem", color: "var(--text-secondary)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.notes || "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: "4px 8px", fontSize: "0.75rem" }} 
                              onClick={() => handleOpenPaymentModal(f)}
                            >
                              ✏️ Record Payment
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                            <td></td>
                            <td colSpan="7" style={{ padding: "8px 16px" }}>
                              <h5 style={{ margin: "0 0 8px 0", fontSize: "0.825rem", color: "var(--text-secondary)" }}>Family Members Roster:</h5>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "450px" }}>
                                {f.members.map(m => (
                                  <div key={m.id} style={{ 
                                    padding: "6px 12px", 
                                    background: "#fff", 
                                    border: "1px solid var(--border-color)", 
                                    borderRadius: 6,
                                    fontSize: "0.825rem",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                  }}>
                                    <span style={{ fontWeight: 600 }}>{m.full_name}</span>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                      <span>Age: {m.age !== null ? m.age : "Unknown"}</span>
                                      <span title={m.is_eligible ? "Eligible (Age 5+ or unknown)" : "Under Age 5 (Excluded from fee count)"}>
                                        {m.is_eligible ? "✅" : "👶"}
                                      </span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === "expenses" && (
        <div>
          {/* Expenses Filter Panel */}
          <div className="card" style={{ padding: 12, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search expenses by description..." 
              value={expenseSearch} 
              onChange={e => setExpenseSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <select 
              className="form-input" 
              value={expenseCategoryFilter} 
              onChange={e => setExpenseCategoryFilter(e.target.value)}
              style={{ width: 180 }}
            >
              <option value="All">All Categories</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Expenses Table */}
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)" }}>
                      No expenses registered yet. Click "Add Expense" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map(e => (
                    <tr key={e.id}>
                      <td><strong>{e.description}</strong></td>
                      <td>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: "var(--border-color)",
                          color: "var(--text-primary)"
                        }}>
                          {e.category}
                        </span>
                      </td>
                      <td style={{ color: "var(--danger)", fontWeight: 600 }}>-${e.amount.toFixed(2)}</td>
                      <td>{e.date}</td>
                      <td style={{ textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }} 
                          onClick={() => handleOpenExpenseModal(e)}
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "4px 8px", fontSize: "0.75rem", color: "var(--danger)" }} 
                          onClick={() => handleDeleteExpense(e.id)}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>{activeExpense ? "Edit Expense" : "Add New Expense"}</h2>
              <button className="modal-close" onClick={() => setIsExpenseModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveExpense}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Description *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Catering Deposit"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Category *</label>
                <select 
                  className="form-input" 
                  value={expenseForm.category}
                  onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                  required
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Amount ($) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  className="form-input" 
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Date *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={expenseForm.date}
                  onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsExpenseModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {activeExpense ? "Save Changes" : "Create Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && activeFamily && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Record Payment</h2>
              <button className="modal-close" onClick={() => setIsPaymentModalOpen(false)}>×</button>
            </div>
            <p style={{ fontSize: "0.875rem", margin: "0 0 16px 0", color: "var(--text-secondary)" }}>
              Updating status for <strong>{activeFamily.display_name}</strong>.<br />
              Tiered Fee expectation: <strong>${activeFamily.calculated_fee.toFixed(2)}</strong> (based on {activeFamily.eligible_count} eligible members).
            </p>
            <form onSubmit={handleSavePayment}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Amount Paid ($) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  className="form-input" 
                  value={paymentForm.amount_paid}
                  onChange={e => setPaymentForm(prev => ({ ...prev, amount_paid: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Payment Status *</label>
                <select 
                  className="form-input" 
                  value={paymentForm.status}
                  onChange={e => setPaymentForm(prev => ({ ...prev, status: e.target.value }))}
                  required
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial Paid</option>
                  <option value="paid">Fully Paid</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">
                  Custom Fee Override ($) {user?.role !== "owner" && "(Owner Only)"}
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  className="form-input" 
                  value={paymentForm.override_fee}
                  onChange={e => setPaymentForm(prev => ({ ...prev, override_fee: e.target.value }))}
                  placeholder="Using tiered rate calculation"
                  disabled={user?.role !== "owner"}
                />
                {user?.role === "owner" && (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: 4 }}>
                    Ignores the default tiered rates for this family if set. Leave blank to reset.
                  </span>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Notes (Payment method, reference number, adjustments)</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Check #402, paid in full on Sunday"
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Payment Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configure Pricing Rates Modal */}
      {isRatesModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Configure Fee Rates</h2>
              <button className="modal-close" onClick={() => setIsRatesModalOpen(false)}>×</button>
            </div>
            <p style={{ fontSize: "0.875rem", margin: "0 0 16px 0", color: "var(--text-secondary)" }}>
              Customize tiered camp registration fees. Changing these rates will automatically recalculate total expected fees.
            </p>
            <form onSubmit={handleSaveRates}>
              {ratesForm.map((rate, index) => {
                let tierLabel = "";
                if (rate.member_count === 1) tierLabel = "Single (1 Member)";
                else if (rate.member_count === 5) tierLabel = "5+ Members Family";
                else tierLabel = `${rate.member_count}-Person Family`;

                return (
                  <div className="form-group" style={{ marginBottom: 12 }} key={rate.member_count}>
                    <label className="form-label">{tierLabel} *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      className="form-input" 
                      value={rate.price}
                      onChange={e => handleRateFormChange(index, e.target.value)}
                      required
                    />
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRatesModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Pricing Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
