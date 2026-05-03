function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">
        Дашборды
      </h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
          KPI 1
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          KPI 2
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          KPI 3
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;