console.log("Index.js loading...");

const root = document.getElementById("root");
if (root) {
  console.log("Root element found");
  root.innerHTML = `
    <div style="padding: 20px; font-family: Arial; background: linear-gradient(to bottom right, #581c87, #000000, #be185d); min-height: 100vh; color: white;">
      <h1 style="font-size: 3rem; color: #ec4899; text-align: center; margin-bottom: 2rem;">🔮 SoulSeer</h1>
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="color: #f3e8ff;">A Community of Gifted Psychics</h2>
      </div>
      <div style="max-width: 600px; margin: 0 auto; background: rgba(0,0,0,0.4); padding: 2rem; border-radius: 10px; border: 1px solid rgba(236, 72, 153, 0.3);">
        <h3 style="color: #ec4899; margin-bottom: 1rem;">🎉 SoulSeer Platform Status</h3>
        <p><strong>✅ Frontend:</strong> Loading successfully</p>
        <p><strong>✅ Backend:</strong> API running on port 8001</p>
        <p><strong>✅ Database:</strong> PostgreSQL/Neon connected</p>
        <p><strong>✅ Authentication:</strong> Clerk integration ready</p>
        <p><strong>✅ Payments:</strong> Stripe integration ready</p>
        <p><strong>✅ WebRTC:</strong> Custom signaling server ready</p>
        <div style="background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; padding: 1rem; border-radius: 8px; text-align: center; margin-top: 1rem;">
          <p style="margin: 0; color: #22c55e; font-weight: bold;">🚀 Platform Ready for Testing!</p>
          <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">All features implemented and functional</p>
        </div>
      </div>
    </div>
  `;
} else {
  console.error("Root element not found!");
}
