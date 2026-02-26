import { AuthForm } from "../../components/auth/AuthForm"

export default function Page() {
  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Top right swirl */}
        <div 
          className="absolute -top-1/4 -right-1/4 w-200 h-200 rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.2) 30%, transparent 70%)",
            transform: "rotate(-30deg)",
          }}
        />
        
        {/* Main blue swirl */}
        <div 
          className="absolute top-1/4 right-0 w-150 h-300"
          style={{
            background: "linear-gradient(180deg, rgba(59, 130, 246, 0.4) 0%, rgba(37, 99, 235, 0.6) 50%, rgba(29, 78, 216, 0.3) 100%)",
            borderRadius: "50% 0 0 50%",
            transform: "rotate(-20deg) translateX(30%)",
            filter: "blur(40px)",
          }}
        />
        
        {/* Bottom blue glow */}
        <div 
          className="absolute -bottom-1/4 left-1/4 w-200 h-150 rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.5) 0%, rgba(37, 99, 235, 0.3) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        
        {/* Accent highlights */}
        <div 
          className="absolute top-1/2 right-1/4 w-75 h-150"
          style={{
            background: "linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.1) 50%, transparent 100%)",
            transform: "rotate(-45deg)",
            filter: "blur(30px)",
          }}
        />
        
        {/* Purple accent */}
        <div 
          className="absolute top-1/3 right-1/3 w-50 h-100"
          style={{
            background: "linear-gradient(180deg, rgba(168, 85, 247, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%)",
            transform: "rotate(-30deg)",
            filter: "blur(50px)",
          }}
        />
      </div>

      {/* Auth form */}
      <AuthForm />
    </main>
  )
}
