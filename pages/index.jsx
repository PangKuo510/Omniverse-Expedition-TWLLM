export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4">
      <h1 className="text-3xl font-bold mb-4 text-center">《語境之門 x LLM》</h1>
      <div className="flex flex-col md:flex-row w-full max-w-5xl">
        <div className="md:w-3/5 w-full p-4">
          <p className="mb-4">這是一段故事文字……</p>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">選項一</button>
            <button className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">選項二</button>
            <button className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">選項三</button>
          </div>
        </div>
        <div className="md:w-2/5 w-full p-4 flex items-center justify-center">
          <img src="https://via.placeholder.com/400x300" alt="placeholder" className="w-full h-auto object-cover rounded" />
        </div>
      </div>
      <div className="w-full max-w-5xl mt-4 flex">
        <input type="text" placeholder="輸入..." className="flex-grow p-2 border rounded-l" />
        <button className="px-4 py-2 bg-green-500 text-white rounded-r hover:bg-green-600">送出</button>
      </div>
    </div>
  );
}
