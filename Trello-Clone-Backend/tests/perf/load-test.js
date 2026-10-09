import autocannon from "autocannon";

// Thiết lập các biến môi trường trước khi load app
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://mock:mock@localhost:5432/mock";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.JWT_SECRET = process.env.JWT_SECRET || "load-test-jwt-secret-key-32-chars-long";

async function runBenchmark(title, options) {
  console.log(`\n================================================================`);
  console.log(`🚀 BẮT ĐẦU ĐO HIỆU NĂNG: ${title}`);
  console.log(`- URL: ${options.url}`);
  console.log(`- Kết nối đồng thời (Connections): ${options.connections}`);
  console.log(`- Thời gian chạy (Duration): ${options.duration}s`);
  console.log(`================================================================`);

  return new Promise((resolve, reject) => {
    autocannon(options, (err, result) => {
      if (err) return reject(err);

      console.log(`\n📊 KẾT QUẢ HIỆU NĂNG: ${title}`);
      console.log(`----------------------------------------------------------------`);
      console.log(`• Tổng số requests hoàn thành: ${result["2xx"] + result["non2xx"]}`);
      console.log(`• Thành công (2xx):            ${result["2xx"]}`);
      console.log(`• Lỗi (Non-2xx / Errors):      ${result["non2xx"] + result.errors}`);
      console.log(`• Throughput (RPS):             ${result.requests.average.toFixed(2)} req/sec`);
      console.log(`• Throughput (Max):             ${result.requests.max} req/sec`);
      console.log(`• Latency trung bình:          ${result.latency.average.toFixed(2)} ms`);
      console.log(`• Latency p50 (Median):         ${result.latency.p50} ms`);
      console.log(`• Latency p90:                  ${result.latency.p90} ms`);
      console.log(`• Latency p97.5:                ${result.latency.p97_5} ms`);
      console.log(`• Latency p99:                  ${result.latency.p99} ms`);
      console.log(`• Băng thông trung bình:        ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/sec`);
      console.log(`----------------------------------------------------------------`);

      const pass = result.latency.p90 < 250 && result.errors === 0;
      console.log(pass ? "✅ ĐÁNH GIÁ: ĐẠT TIÊU CHUẨN HIỆU NĂNG CAO (p90 < 250ms)" : "⚠️ ĐÁNH GIÁ: CẦN TỐI ƯU THÊM");

      resolve(result);
    });
  });
}

async function main() {
  const targetUrl = process.env.TARGET_URL || "http://103.82.193.221:4000";
  let server = null;
  let baseUrl = targetUrl;

  console.log(`* Địa chỉ mục tiêu kiểm thử hiệu năng: ${baseUrl}`);

  try {
    // Kịch bản 1: Benchmark endpoint Health Check
    await runBenchmark("API Health Check (/health)", {
      url: `${baseUrl}/health`,
      connections: 50,
      duration: 5,
    });

    // Kịch bản 2: Benchmark endpoint Auth Setup Status
    await runBenchmark("API Auth Setup Status (/api/auth/setup-status)", {
      url: `${baseUrl}/api/auth/setup-status`,
      connections: 50,
      duration: 5,
    });

    // Kịch bản 3: Benchmark endpoint Public Landing Data
    await runBenchmark("API Landing Public Data (/api/landing)", {
      url: `${baseUrl}/api/landing`,
      connections: 50,
      duration: 5,
    });
  } catch (error) {
    console.error("Lỗi khi chạy benchmark:", error);
  } finally {
    if (server) {
      server.close();
      console.log("\n* Đã đóng Backend Test Server.");
    }
    process.exit(0);
  }
}

main();
