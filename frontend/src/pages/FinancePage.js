import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const EXPENSE_CATEGORIES = ["Catering", "Lodging", "Transportation", "Activities", "Supplies", "Other"];

// Receipt preview helper with token authentication support
const ReceiptPreview = ({ expenseId, filename }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (filename.toLowerCase().endsWith(".pdf")) {
      setLoading(false);
      return;
    }
    
    let active = true;
    api.get(`/api/finance/expenses/${expenseId}/receipt`, { responseType: "blob" })
      .then(res => {
        if (active) {
          const url = URL.createObjectURL(res.data);
          setSrc(url);
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (src) URL.revokeObjectURL(src);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId, filename]);

  if (loading) return <div style={{ fontSize: "0.85rem", color: "var(--muted)", padding: 20 }}>Loading preview…</div>;
  
  if (filename.toLowerCase().endsWith(".pdf")) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <span style={{ fontSize: "2rem" }}>📄</span>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginTop: 8 }}>PDF Document</div>
        <span className="text-muted" style={{ fontSize: "0.7rem", wordBreak: "break-all", display: "block", marginTop: 4 }}>
          {filename.replace(/^expense_\d+_/, '')}
        </span>
      </div>
    );
  }

  return src ? (
    <img 
      src={src} 
      alt="Receipt Preview" 
      style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 6 }} 
    />
  ) : (
    <div style={{ fontSize: "0.85rem", color: "var(--danger)", padding: 20 }}>Failed to load preview</div>
  );
};

export default function FinancePage() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState("fees");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Stats State
  const [stats, setStats] = useState({
    total_expenses: 0,
    total_expected_fees: 0,
    total_collected_fees: 0,
    total_discounts: 0,
    net_balance: 0
  });

  // Families State
  const [families, setFamilies] = useState([]);
  const [familySearch, setFamilySearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all"); // all, unpaid, partial, paid
  const [expandedFamilies, setExpandedFamilies] = useState({});

  // Dynamic Activity Configs
  const [activityNames, setActivityNames] = useState(["Kayaking", "Boat Tour"]);
  const [activityPrices, setActivityPrices] = useState([10.0, 20.0]);
  const [actPricesForm, setActPricesForm] = useState(["10.0", "20.0"]);

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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activeExpense, setActiveExpense] = useState(null); // null means new, otherwise expense object
  const [selectedFile, setSelectedFile] = useState(null);
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

  // Merge Families State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetFg, setMergeTargetFg] = useState("");
  const [mergeSourceFg, setMergeSourceFg] = useState("");
  const [merging, setMerging] = useState(false);

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  };

  const flashError = (msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  };

  const canReadFinance = hasPermission("finance", "read");
  const canUploadReceipts = hasPermission("receipt_upload", "edit") || hasPermission("receipt_upload", "read");

  useEffect(() => {
    if (!canReadFinance && canUploadReceipts) {
      setActiveTab("expenses");
    }
  }, [canReadFinance, canUploadReceipts]);

  // Fetch Data
  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      if (!canReadFinance && canUploadReceipts) {
        const expensesRes = await api.get("/api/finance/expenses");
        setExpenses(expensesRes.data.expenses);
      } else {
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
        if (feesRes.data.activity_names) {
          setActivityNames(feesRes.data.activity_names);
        }
        if (feesRes.data.activity_prices) {
          setActivityPrices(feesRes.data.activity_prices);
        }
      }
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
    setSelectedFile(null);
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
      let savedExpenseId = null;
      if (activeExpense) {
        // Update
        await api.put(`/api/finance/expenses/${activeExpense.id}`, expenseForm);
        savedExpenseId = activeExpense.id;
        flashSuccess("Expense updated successfully!");
      } else {
        // Create
        const res = await api.post("/api/finance/expenses", expenseForm);
        savedExpenseId = res.data.expense.id;
        flashSuccess("Expense added successfully!");
      }

      if (selectedFile && savedExpenseId) {
        const formData = new FormData();
        formData.append("receipt", selectedFile);
        await api.post(`/api/finance/expenses/${savedExpenseId}/receipt`, formData, {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        });
      }

      setIsExpenseModalOpen(false);
      fetchFinanceData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save expense.");
    }
  };

  const handleDownloadReceipt = async (expenseId, filename) => {
    try {
      setSuccess("");
      setError("");
      
      const response = await api.get(`/api/finance/expenses/${expenseId}/receipt`, {
        responseType: "blob",
      });
      
      const blob = new Blob([response.data], { type: response.headers["content-type"] });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      flashSuccess("Receipt downloaded successfully!");
    } catch (err) {
      console.error(err);
      setError("Failed to download receipt.");
    }
  };

  const handleDownloadReceiptsZip = async () => {
    try {
      setSuccess("");
      setError("");
      
      const response = await api.get("/api/finance/expenses/receipts-zip", {
        responseType: "blob",
      });
      
      const blob = new Blob([response.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "gca_expenses_receipts.zip");
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      flashSuccess("All expense receipts ZIP downloaded successfully!");
    } catch (err) {
      console.error(err);
      setError("Failed to download receipts ZIP archive. Are there any uploaded files?");
    }
  };

  const handleDeleteReceipt = async (expenseId) => {
    if (!window.confirm("Are you sure you want to permanently delete this receipt?")) return;
    try {
      setSuccess("");
      setError("");
      await api.delete(`/api/finance/expenses/${expenseId}/receipt`);
      flashSuccess("Receipt deleted successfully!");
      fetchFinanceData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to delete receipt.");
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

  const handleSetHeadOfFamily = async (family_group, head_camper_id) => {
    try {
      await api.post("/api/finance/set-head", { family_group, head_camper_id });
      flashSuccess("Head of Family updated successfully!");
      fetchFinanceData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update Head of Family.");
    }
  };

  // Payment CRUD
  const handleOpenPaymentModal = (family) => {
    setActiveFamily(family);
    setPaymentForm({
      amount_paid: family.amount_paid,
      status: family.status,
      notes: family.notes || "",
      override_fee: family.override_fee !== null ? family.override_fee : "",
      discount: family.discount !== null && family.discount !== undefined ? family.discount : "",
      head_camper_id: family.head_camper_id || (family.members?.[0]?.id || "")
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
        override_fee: paymentForm.override_fee !== "" ? paymentForm.override_fee : null,
        discount: paymentForm.discount !== "" ? parseFloat(paymentForm.discount) : 0.0
      });

      if (user?.role === "owner" && paymentForm.head_camper_id && parseInt(paymentForm.head_camper_id) !== activeFamily.head_camper_id) {
        await api.post("/api/finance/set-head", {
          family_group: activeFamily.family_group,
          head_camper_id: parseInt(paymentForm.head_camper_id)
        });
      }

      flashSuccess(`Payment details for '${activeFamily.display_name}' saved!`);
      setIsPaymentModalOpen(false);
      fetchFinanceData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to record payment details.");
    }
  };

  // Merge Families Handlers
  const handleOpenMergeModal = (sourceFamily = null) => {
    if (sourceFamily && sourceFamily.family_group) {
      setMergeSourceFg(sourceFamily.family_group);
      setMergeTargetFg("");
    } else {
      setMergeSourceFg("");
      setMergeTargetFg("");
    }
    setIsMergeModalOpen(true);
  };

  const handleExecuteMerge = async () => {
    if (!mergeTargetFg || !mergeSourceFg || mergeTargetFg === mergeSourceFg) return;
    setMerging(true);
    setError("");
    try {
      const res = await api.post("/api/finance/merge-families", {
        target_family_group: mergeTargetFg,
        source_family_group: mergeSourceFg
      });
      flashSuccess(res.data.message || "Families grouped successfully!");
      setIsMergeModalOpen(false);
      fetchFinanceData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to group families.");
    } finally {
      setMerging(false);
    }
  };

  // Rates Pricing Configuration handlers
  const handleOpenRatesModal = () => {
    setRatesForm(rates.map(r => ({ ...r })));
    setActPricesForm(
      activityNames.map((name, idx) => {
        return activityPrices[idx] !== undefined ? String(activityPrices[idx]) : "15.0";
      })
    );
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
      if (user?.role === "owner") {
        const payload = {};
        activityNames.forEach((name, idx) => {
          payload[`activity_${idx + 1}_price`] = actPricesForm[idx] || "15.0";
        });
        await api.post("/api/settings/", payload);
      }
      flashSuccess("Pricing rates saved successfully!");
      setIsRatesModalOpen(false);
      fetchFinanceData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save fee pricing rates.");
    }
  };

  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print/export PDF.");
      return;
    }
    
    const statsHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Expected Fees</div>
          <div class="metric-value">$${(stats.total_expected_fees || 0).toFixed(2)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Collected Fees</div>
          <div class="metric-value">$${(stats.total_collected_fees || 0).toFixed(2)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Expenses</div>
          <div class="metric-value">$${(stats.total_expenses || 0).toFixed(2)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Net Balance</div>
          <div class="metric-value" style="color: ${stats.net_balance >= 0 ? '#27ae60' : '#c0392b'}">$${(stats.net_balance || 0).toFixed(2)}</div>
        </div>
      </div>
    `;

    const totalReg = families.reduce((sum, f) => sum + (f.calculated_fee || 0), 0);
    const totalAct = families.reduce((sum, f) => sum + (f.activity_fee || 0), 0);
    const totalExp = families.reduce((sum, f) => sum + (f.total_expected_fee || 0), 0);
    const totalPaid = families.reduce((sum, f) => sum + (f.amount_paid || 0), 0);

    const feesRows = families.map(f => `
      <tr>
        <td>Family #${f.family_group} (${f.display_name})</td>
        <td>${f.eligible_count}</td>
        <td>$${(f.calculated_fee || 0).toFixed(2)}</td>
        <td>$${(f.activity_fee || 0).toFixed(2)}</td>
        <td>$${(f.total_expected_fee || 0).toFixed(2)}</td>
        <td>$${(f.amount_paid || 0).toFixed(2)}</td>
        <td>${f.status.toUpperCase()}</td>
      </tr>
    `).join("") + `
      <tr style="font-weight: bold; background-color: #eee;">
        <td>Total</td>
        <td></td>
        <td>$${totalReg.toFixed(2)}</td>
        <td>$${totalAct.toFixed(2)}</td>
        <td>$${totalExp.toFixed(2)}</td>
        <td>$${totalPaid.toFixed(2)}</td>
        <td></td>
      </tr>
    `;

    const expensesRows = expenses.map(e => `
      <tr>
        <td>${e.date}</td>
        <td>${e.category}</td>
        <td>${e.description}</td>
        <td>$${(e.amount || 0).toFixed(2)}</td>
      </tr>
    `).join("");

    const currentYear = new Date().getFullYear();

    const htmlContent = `
      <html>
        <head>
          <title>GCA ${currentYear} Church Camp - Financial Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #2c3e50; padding: 20px; }
            h1 { color: #1e4d2b; border-bottom: 2px solid #1e4d2b; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { color: #1e4d2b; margin-top: 30px; font-size: 1.25rem; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
            .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .metric-card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; text-align: center; }
            .metric-label { font-size: 0.75rem; text-transform: uppercase; color: #7f8c8d; font-weight: 600; margin-bottom: 5px; }
            .metric-value { font-size: 1.5rem; font-weight: 700; color: #2c3e50; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.875rem; }
            th, td { border: 1px solid #e0e0e0; padding: 10px 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: 600; }
            tr:nth-child(even) { background-color: #fafafa; }
            .print-btn-bar { margin-bottom: 20px; display: flex; gap: 10px; }
            @media print {
              .print-btn-bar { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-btn-bar">
            <button onclick="window.print()" style="padding: 10px 20px; background: #1e4d2b; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">🖨️ Print / Save as PDF</button>
            <button onclick="window.close()" style="padding: 10px 20px; background: #e0e0e0; color: #333; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">Close</button>
          </div>
          <h1>Grace Christian Assembly - GCA ${currentYear} Church Camp Financial Report</h1>
          
          ${statsHTML}

          <h2>Camp Registration Fees</h2>
          <table>
            <thead>
              <tr>
                <th>Family Group</th>
                <th>Eligible Members</th>
                <th>Registration Fee</th>
                <th>Activity Fee</th>
                <th>Total expected</th>
                <th>Amount Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${feesRows}
            </tbody>
          </table>

          <h2>Itemized Expenses</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${expensesRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    let csvContent = "\ufeff"; // Add UTF-8 BOM for Excel compatibility
    
    // 1. Title & Summary Metrics
    csvContent += "Grace Christian Assembly Camp - Financial Report\n\n";
    csvContent += "SUMMARY METRICS\n";
    csvContent += "Expected Fees,Collected Fees,Total Discounts,Total Expenses,Net Balance\n";
    csvContent += `"${(stats.total_expected_fees || 0).toFixed(2)}","${(stats.total_collected_fees || 0).toFixed(2)}","${(stats.total_discounts || 0).toFixed(2)}","${(stats.total_expenses || 0).toFixed(2)}","${(stats.net_balance || 0).toFixed(2)}"\n\n`;

    // 2. Family Camp Fees Table
    csvContent += "CAMP REGISTRATION FEES\n";
    csvContent += "Family Group,Display Name,Eligible Member Count,Registration Fee,Church Discount,Activity Fee,Total Expected Fee,Paid Amount,Payment Status,Notes\n";
    families.forEach(f => {
      csvContent += `"${f.family_group}","${f.display_name}","${f.eligible_count}","${(f.calculated_fee || 0).toFixed(2)}","${(f.discount || 0).toFixed(2)}","${(f.activity_fee || 0).toFixed(2)}","${(f.total_expected_fee || 0).toFixed(2)}","${(f.amount_paid || 0).toFixed(2)}","${f.status}","${(f.notes || "").replace(/"/g, '""')}"\n`;
    });
    const totalReg = families.reduce((sum, f) => sum + (f.calculated_fee || 0), 0);
    const totalDisc = families.reduce((sum, f) => sum + (f.discount || 0), 0);
    const totalAct = families.reduce((sum, f) => sum + (f.activity_fee || 0), 0);
    const totalExp = families.reduce((sum, f) => sum + (f.total_expected_fee || 0), 0);
    const totalPaid = families.reduce((sum, f) => sum + (f.amount_paid || 0), 0);
    csvContent += `"Total","","","${totalReg.toFixed(2)}","${totalDisc.toFixed(2)}","${totalAct.toFixed(2)}","${totalExp.toFixed(2)}","${totalPaid.toFixed(2)}","",""\n`;
    csvContent += "\n";

    // 3. Expenses Table
    csvContent += "ITEMIZED EXPENSES\n";
    csvContent += "Date,Category,Description,Amount\n";
    expenses.forEach(e => {
      csvContent += `"${e.date}","${e.category}","${(e.description || "").replace(/"/g, '""')}","${(e.amount || 0).toFixed(2)}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gca_camp_financial_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    const grossRegistrationBase = filteredFamilies.reduce((sum, f) => {
      const base = f.override_fee !== null ? f.override_fee : f.tiered_fee;
      return sum + (base || 0);
    }, 0);
    const totalDiscounts = filteredFamilies.reduce((sum, f) => sum + (f.discount || 0), 0);
    const totalRegistrationBase = filteredFamilies.reduce((sum, f) => sum + (f.calculated_fee || 0), 0);
    const totalActivityFees = filteredFamilies.reduce((sum, f) => sum + (f.activity_fee || 0), 0);
    const totalExpectedCombined = filteredFamilies.reduce((sum, f) => sum + (f.total_expected_fee || 0), 0);
    const totalPaidCombined = filteredFamilies.reduce((sum, f) => sum + (f.amount_paid || 0), 0);

    if (!canReadFinance && !canUploadReceipts) {
      return (
        <div className="container" style={{ padding: "40px 20px" }}>
          <div className="alert alert-error">
            🔒 <strong>Access Denied:</strong> You do not have permission to view Finance or upload receipts.
          </div>
        </div>
      );
    }

    return (
    <div className="container" style={{ padding: "20px 0" }}>
      <style>{`
        @media (max-width: 768px) {
          .mobile-fab-btn {
            display: flex !important;
          }
          .header-action-btn-desktop {
            display: none !important;
          }
        }
      `}</style>

      {/* Page Header */}
      <div style={{ 
        display: "flex", 
        flexDirection: "row", 
        flexWrap: "wrap", 
        justifyContent: "space-between", 
        alignItems: "center", 
        gap: "16px",
        marginBottom: 28 
      }}>
        <div style={{ minWidth: "280px", flex: "1 1 auto" }}>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 600 }}>
            {canReadFinance ? "💰 Finance Manager" : "🧾 Expense & Receipt Submitter"}
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            {canReadFinance 
              ? "Track itemized camp expenses and collection of tiered family registration fees." 
              : "Submit camp expenses and upload vendor receipt images or documents."}
          </p>
        </div>
        <div style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          gap: "8px", 
          alignItems: "center"
        }}>
          {(user?.role === "owner" || user?.role === "finance" || user?.role === "admin") && (
            <>
              <button className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: "0.85rem" }} onClick={handlePrintPDF}>
                📄 Print Report (PDF)
              </button>
              <button className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: "0.85rem" }} onClick={handleExportCSV}>
                📊 Export CSV (Excel)
              </button>
            </>
          )}
          {activeTab === "expenses" && (user?.role === "owner" || user?.role === "finance" || user?.role === "admin") && (
            <>
              <button 
                className="btn btn-secondary" 
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: "0.85rem" }} 
                onClick={() => setIsGalleryOpen(true)}
              >
                🖼️ View Receipts
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: "0.85rem" }} 
                onClick={handleDownloadReceiptsZip}
              >
                📦 Download Receipts (ZIP)
              </button>
            </>
          )}
          {activeTab === "fees" && hasPermission("finance", "edit") && (
            <>
              <button className="btn btn-secondary" style={{ padding: "8px 12px", fontSize: "0.85rem" }} onClick={() => handleOpenMergeModal()}>
                🔗 Group Families
              </button>
              <button className="btn btn-secondary" style={{ padding: "8px 12px", fontSize: "0.85rem" }} onClick={handleOpenRatesModal}>
                ⚙️ Configure Pricing
              </button>
            </>
          )}
          {activeTab === "expenses" && (hasPermission("finance", "edit") || hasPermission("receipt_upload", "edit")) && (
            <button className="btn btn-primary header-action-btn-desktop" style={{ padding: "8px 12px", fontSize: "0.85rem" }} onClick={() => handleOpenExpenseModal()}>
              ➕ Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Error & Success banners */}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ {success}</div>}

      {/* Summary KPI Grid */}
      {canReadFinance && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24
        }}>
          <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", borderLeft: "4px solid var(--forest)" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600 }}>Expected Fees</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, margin: "8px 0" }}>${(stats.total_expected_fees || 0).toFixed(2)}</span>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 3, marginTop: 4, borderTop: "1px solid var(--border-color)", paddingTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Base Registration:</span>
                <strong style={{ color: "var(--charcoal)" }}>${grossRegistrationBase.toFixed(2)}</strong>
              </div>
              {totalDiscounts > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#d97706" }}>
                  <span>Church Discounts:</span>
                  <strong>-${totalDiscounts.toFixed(2)}</strong>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Activity Fees:</span>
                <strong style={{ color: "var(--forest-mid)" }}>${totalActivityFees.toFixed(2)}</strong>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", borderLeft: "4px solid #2ecc71" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600 }}>Collected Fees</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, margin: "8px 0", color: "#2ecc71" }}>${(stats.total_collected_fees || 0).toFixed(2)}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {stats.total_expected_fees > 0 
                ? `${(((stats.total_collected_fees || 0) / stats.total_expected_fees) * 100).toFixed(1)}% of expectation` 
                : "0% of expectation"}
            </span>
          </div>
          <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", borderLeft: "4px solid #f59e0b" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600 }}>Church Discounts</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, margin: "8px 0", color: "#d97706" }}>${(stats.total_discounts || 0).toFixed(2)}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Total discounts granted</span>
          </div>
          <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", borderLeft: "4px solid var(--danger)" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600 }}>Total Expenses</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, margin: "8px 0", color: "var(--danger)" }}>${(stats.total_expenses || 0).toFixed(2)}</span>
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
            }}>${(stats.net_balance || 0).toFixed(2)}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Collected Fees minus Expenses</span>
          </div>
        </div>
      )}

      {/* Premium Segmented Card Tabs */}
      {canReadFinance && (
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
              border: "1px solid var(--border-color)",
              borderLeft: "4px solid var(--forest)",
              borderRadius: "10px",
              color: activeTab === "fees" ? "var(--forest)" : "var(--text-secondary)",
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
              border: "1px solid var(--border-color)",
              borderLeft: "4px solid var(--danger)",
              borderRadius: "10px",
              color: activeTab === "expenses" ? "var(--danger)" : "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              boxShadow: activeTab === "expenses" ? "0 4px 12px rgba(192, 57, 43, 0.06)" : "none",
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
      )}

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
                  <th>Registration Fee</th>
                  <th>Church Discount</th>
                  <th>Activity Fee</th>
                  <th>Total expected</th>
                  <th>Amount Paid</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFamilies.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)" }}>
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
                                <strong style={{ color: "#e67e22" }}>${(f.calculated_fee || 0).toFixed(2)}</strong>
                                <span style={{ 
                                  display: "block", 
                                  fontSize: "0.675rem", 
                                  color: "var(--text-secondary)", 
                                  textDecoration: "line-through" 
                                }}>
                                  Tier: ${(f.tiered_fee || 0).toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <strong>${(f.calculated_fee || 0).toFixed(2)}</strong>
                            )}
                          </td>
                          <td>
                            {f.discount > 0 ? (
                              <strong style={{ color: "#d97706" }}>${(f.discount || 0).toFixed(2)}</strong>
                            ) : (
                              <span style={{ color: "var(--text-secondary)" }}>—</span>
                            )}
                          </td>
                          <td>
                            {f.activity_fee > 0 ? (
                              <div>
                                <strong style={{ color: "var(--forest-mid)" }}>${(f.activity_fee || 0).toFixed(2)}</strong>
                                <span style={{ display: "block", fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                                  {[
                                    f.activity_1_spots > 0 && `${f.activity_1_spots}x ${activityNames[0] || "Kayaking"}`,
                                    f.activity_2_spots > 0 && `${f.activity_2_spots}x ${activityNames[1] || "Boat Tour"}`
                                  ].filter(Boolean).join(", ")}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-secondary)" }}>$0.00</span>
                            )}
                          </td>
                          <td>
                            <strong>${(f.total_expected_fee || 0).toFixed(2)}</strong>
                          </td>
                          <td style={{ color: f.amount_paid > 0 ? "#2ecc71" : "inherit" }}>
                            <strong>${(f.amount_paid || 0).toFixed(2)}</strong>
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
                            {hasPermission("finance", "edit") && (
                              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: "4px 8px", fontSize: "0.75rem" }} 
                                  onClick={() => handleOpenMergeModal(f)}
                                  title="Group this family into another family group"
                                >
                                  🔗 Group
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: "4px 8px", fontSize: "0.75rem" }} 
                                  onClick={() => handleOpenPaymentModal(f)}
                                >
                                  ✏️ Record Payment
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                            <td></td>
                            <td colSpan="9" style={{ padding: "8px 16px" }}>
                              <h5 style={{ margin: "0 0 8px 0", fontSize: "0.825rem", color: "var(--text-secondary)" }}>Family Members Roster:</h5>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "600px" }}>
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
                                    <div>
                                      <span style={{ fontWeight: 600 }}>{m.full_name}</span>
                                      {user?.role === "owner" && (
                                        m.id === f.head_camper_id ? (
                                          <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: "0.7rem", padding: "2px 6px" }}>
                                            👑 Head of Family
                                          </span>
                                        ) : (
                                          <button 
                                            className="btn btn-ghost" 
                                            onClick={() => handleSetHeadOfFamily(f.family_group, m.id)}
                                            style={{ marginLeft: 8, fontSize: "0.7rem", padding: "2px 6px", border: "1px dashed var(--border-color)", cursor: "pointer" }}
                                            title="Designate as Head of Family (Owner Only)"
                                          >
                                            👑 Make Head
                                          </button>
                                        )
                                      )}
                                      {(m.kayaking > 0 || m.boat_tour > 0) && (
                                        <span style={{ marginLeft: 10, fontSize: "0.75rem", background: "var(--light-bg)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border-color)", color: "var(--forest)" }}>
                                          {[
                                            m.kayaking > 0 && `${m.kayaking}x ${activityNames[0] || "Kayaking"}`,
                                            m.boat_tour > 0 && `${m.boat_tour}x ${activityNames[1] || "Boat Tour"}`
                                          ].filter(Boolean).join(", ")}
                                        </span>
                                      )}
                                    </div>
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
              <tfoot>
                <tr style={{ background: "var(--light-bg)", fontWeight: "bold", borderTop: "2px solid var(--border-color)" }}>
                  <td></td>
                  <td>Total Summary</td>
                  <td></td>
                  <td>${totalRegistrationBase.toFixed(2)}</td>
                  <td>${totalActivityFees.toFixed(2)}</td>
                  <td>${totalExpectedCombined.toFixed(2)}</td>
                  <td>${totalPaidCombined.toFixed(2)}</td>
                  <td colSpan="3"></td>
                </tr>
              </tfoot>
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
                      <td style={{ color: "var(--danger)", fontWeight: 600 }}>-${(e.amount || 0).toFixed(2)}</td>
                      <td>{e.date}</td>
                      <td style={{ textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                        {e.receipt_filename && (user?.role === "owner" || user?.role === "finance" || user?.role === "admin") && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: "4px 8px", fontSize: "0.75rem" }} 
                            onClick={() => handleDownloadReceipt(e.id, e.receipt_filename)}
                            title="Download Attached Receipt"
                          >
                            📄 Receipt
                          </button>
                        )}
                        {hasPermission("finance", "edit") && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: "4px 8px", fontSize: "0.75rem" }} 
                            onClick={() => handleOpenExpenseModal(e)}
                          >
                            ✏️ Edit
                          </button>
                        )}
                        {hasPermission("finance", "edit") && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: "4px 8px", fontSize: "0.75rem", color: "var(--danger)" }} 
                            onClick={() => handleDeleteExpense(e.id)}
                          >
                            🗑️ Delete
                          </button>
                        )}
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
              {hasPermission("receipt_upload", "edit") && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Receipt File (Optional)</label>
                  <input 
                    type="file" 
                    className="form-input" 
                    accept=".png,.jpg,.jpeg,.pdf"
                    onChange={e => setSelectedFile(e.target.files[0] || null)}
                    style={{ paddingTop: 8, paddingBottom: 8, height: "auto" }}
                  />
                  <span className="text-muted" style={{ fontSize: "0.7rem", marginTop: 4, display: "block" }}>
                    Supports PNG, JPG, JPEG, and PDF up to 5MB.
                  </span>
                </div>
              )}
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
            <div style={{ fontSize: "0.875rem", margin: "0 0 16px 0", padding: "10px 12px", background: "var(--light-bg)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
              <div style={{ marginBottom: 4 }}>Family: <strong>{activeFamily.display_name}</strong></div>
              <div>Registration Fee: <strong>${(activeFamily.calculated_fee || 0).toFixed(2)}</strong> ({activeFamily.eligible_count} members)</div>
              {activeFamily.activity_fee > 0 && (
                <div>Activity Surcharge: <strong>${(activeFamily.activity_fee || 0).toFixed(2)}</strong></div>
              )}
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border-color)", fontWeight: 700 }}>
                Total Expected: <span>${(activeFamily.total_expected_fee || 0).toFixed(2)}</span>
              </div>
            </div>
            <form onSubmit={handleSavePayment}>
              {user?.role === "owner" && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Head of Family</label>
                  <select 
                    className="form-input" 
                    value={paymentForm.head_camper_id || ""}
                    onChange={e => setPaymentForm(prev => ({ ...prev, head_camper_id: e.target.value }))}
                  >
                    {activeFamily?.members?.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} {m.id === activeFamily.head_camper_id ? "👑 (Current Head)" : ""}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: 4 }}>
                    Designate which member is the official Head of Family.
                  </span>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Payment Amount Paid ($) *</label>
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
                <label className="form-label">Church Discount ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  className="form-input" 
                  value={paymentForm.discount}
                  onChange={e => setPaymentForm(prev => ({ ...prev, discount: e.target.value }))}
                  placeholder="e.g. 50.00"
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: 4 }}>
                  Discount applied to reduce the family registration fee.
                </span>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">
                  Custom Fee Override ($) {!(user?.role === "owner" || user?.role === "finance") && "(Owner / Finance Only)"}
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  className="form-input" 
                  value={paymentForm.override_fee}
                  onChange={e => setPaymentForm(prev => ({ ...prev, override_fee: e.target.value }))}
                  placeholder="Using tiered rate calculation"
                  disabled={!(user?.role === "owner" || user?.role === "finance")}
                />
                {(user?.role === "owner" || user?.role === "finance") && (
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

              <h3 style={{ fontSize: "0.95rem", margin: "20px 0 12px 0", borderTop: "1px solid var(--border-color)", paddingTop: 16, color: "var(--forest)", fontWeight: 700 }}>
                🚴 Activity Prices per Spot
              </h3>
              {activityNames.map((name, idx) => (
                <div className="form-group" style={{ marginBottom: 12 }} key={idx}>
                  <label className="form-label">
                    {idx === 0 ? "🛶" : idx === 1 ? "🚤" : "🎯"} {name} Price ($) * {user?.role !== "owner" && "(Owner Only)"}
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="form-input" 
                    value={actPricesForm[idx] || ""}
                    onChange={e => {
                      const val = e.target.value;
                      setActPricesForm(prev => {
                        const copy = [...prev];
                        copy[idx] = val;
                        return copy;
                      });
                    }}
                    required
                    disabled={user?.role !== "owner"}
                  />
                </div>
              ))}



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

      {/* Mobile Floating Action Button for Adding Expense */}
      {activeTab === "expenses" && (hasPermission("finance", "edit") || hasPermission("receipt_upload", "edit")) && (
        <button 
          className="mobile-fab-btn" 
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "var(--forest)",
            color: "#fff",
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            display: "none",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "1.5rem",
            zIndex: 1000,
            cursor: "pointer"
          }}
          onClick={() => handleOpenExpenseModal()}
          title="Add Expense"
        >
          ➕
        </button>
      )}

      {/* Receipts Gallery Modal */}
      {isGalleryOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 800, width: "90%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="modal-header">
              <h2>Receipts</h2>
              <button className="modal-close" onClick={() => setIsGalleryOpen(false)}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 0" }}>
              {expenses.filter(e => e.receipt_filename).length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>
                  No receipts uploaded yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {expenses.filter(e => e.receipt_filename).map(e => (
                    <div 
                      key={e.id} 
                      className="card" 
                      style={{ 
                        padding: 16, 
                        display: "flex", 
                        flexDirection: "row", 
                        alignItems: "center", 
                        gap: 20,
                        flexWrap: "wrap"
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--forest)" }}>{e.description}</span>
                            <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--danger)" }}>-${(e.amount || 0).toFixed(2)}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, fontSize: "0.8rem", color: "var(--muted)" }}>
                            <span>{e.date}</span>
                            <span>•</span>
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: 12,
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              background: "var(--border-color)",
                              color: "var(--text-primary)"
                            }}>
                              {e.category}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: "6px 16px", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 4 }} 
                            onClick={() => handleDownloadReceipt(e.id, e.receipt_filename)}
                          >
                            📥 Download
                          </button>
                          {(user?.role === "owner" || user?.role === "finance" || user?.role === "admin") && (
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: "6px 16px", fontSize: "0.78rem", color: "var(--danger)", borderColor: "var(--danger)", display: "flex", alignItems: "center", gap: 4 }} 
                              onClick={() => handleDeleteReceipt(e.id)}
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ 
                        width: "220px", 
                        height: "140px", 
                        display: "flex", 
                        justifyContent: "center", 
                        alignItems: "center", 
                        background: "rgba(0,0,0,0.01)", 
                        borderRadius: 6, 
                        overflow: "hidden",
                        border: "1px solid var(--border-color)"
                      }}>
                        <ReceiptPreview expenseId={e.id} filename={e.receipt_filename} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: 16, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setIsGalleryOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Merge / Group Families Modal */}
      {isMergeModalOpen && (
        <div className="modal-overlay" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.5)", display: "flex",
          justifyContent: "center", alignItems: "center", zIndex: 1000
        }}>
          <div className="modal-card" style={{
            background: "#fff", padding: 24, borderRadius: 12,
            width: "90%", maxWidth: 500, boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
          }}>
            <h3 style={{ margin: "0 0 12px 0", color: "var(--forest)" }}>🔗 Group Two Families Together</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 16 }}>
              Select two families to combine. All members from the secondary family will be reassigned to the primary family group. This reduces the total family count by 1 and automatically recalculates tiered fees for the combined family size.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Primary Family Group (Target) *</label>
                <select 
                  className="form-input" 
                  value={mergeTargetFg} 
                  onChange={e => setMergeTargetFg(e.target.value)}
                >
                  <option value="">-- Select Primary Family --</option>
                  {families.map(f => (
                    <option key={f.family_group} value={f.family_group} disabled={f.family_group === mergeSourceFg}>
                      {f.display_name} ({f.members.length} {f.members.length === 1 ? 'member' : 'members'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Secondary Family to Merge (Source) *</label>
                <select 
                  className="form-input" 
                  value={mergeSourceFg} 
                  onChange={e => setMergeSourceFg(e.target.value)}
                >
                  <option value="">-- Select Family to Merge --</option>
                  {families.map(f => (
                    <option key={f.family_group} value={f.family_group} disabled={f.family_group === mergeTargetFg}>
                      {f.display_name} ({f.members.length} {f.members.length === 1 ? 'member' : 'members'})
                    </option>
                  ))}
                </select>
              </div>

              {mergeTargetFg && mergeSourceFg && (
                <div style={{
                  padding: 12, background: "rgba(34, 76, 56, 0.05)",
                  borderRadius: 6, fontSize: "0.825rem", color: "var(--forest)", borderLeft: "3px solid var(--forest)"
                }}>
                  💡 <strong>Summary:</strong> Members from <strong>{families.find(f => f.family_group === mergeSourceFg)?.display_name}</strong> will join <strong>{families.find(f => f.family_group === mergeTargetFg)?.display_name}</strong>.
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsMergeModalOpen(false)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  disabled={!mergeTargetFg || !mergeSourceFg || mergeTargetFg === mergeSourceFg || merging}
                  onClick={handleExecuteMerge}
                >
                  {merging ? "Grouping..." : "🔗 Group Families Together"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
