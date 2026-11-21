"""Cut a 12 s piece from a track and give it a natural ending (ring-out), for muxing onto a 12 s video.
usage: fit_music.py <in audio> <out wav> <start offset s> [dur=12] [fade_start=9.4] [fade_in=0.02]"""
import sys, subprocess, numpy as np
src,out=sys.argv[1],sys.argv[2]; off=float(sys.argv[3])
DUR=float(sys.argv[4]) if len(sys.argv)>4 else 12.0
FS=float(sys.argv[5]) if len(sys.argv)>5 else 9.4
FI=float(sys.argv[6]) if len(sys.argv)>6 else 0.02
SR=48000
raw=subprocess.run(['ffmpeg','-v','error','-ss',str(off),'-t',str(DUR+0.5),'-i',src,'-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
x=np.frombuffer(raw,np.float32).reshape(-1,2)[:int(DUR*SR)].copy()
n=len(x); t=np.arange(n)/SR
# synthetic hall reverb IR (~2 s), decorrelated per channel
rng=np.random.default_rng(1); L=int(2.2*SR); tt=np.arange(L)/SR
ir=np.stack([rng.standard_normal(L),rng.standard_normal(L)],1)*np.exp(-tt*3.2)[:,None]
ir[:int(0.012*SR)]=0; ir/=np.sqrt((ir**2).sum(0))
def conv(a,b):
    m=len(a)+len(b)-1; N=1<<(m-1).bit_length()
    return np.fft.irfft(np.fft.rfft(a,N)*np.fft.rfft(b,N),N)[:len(a)]
wet=np.stack([conv(x[:,c],ir[:,c]) for c in range(2)],1)
# dry fades out with a cosine from FS to DUR-0.35; reverb send rises so the music rings out instead of just getting quieter
u=np.clip((t-FS)/(DUR-0.35-FS),0,1)
g_dry=np.cos(u*np.pi/2)**1.4
g_wet=0.10+0.55*np.sin(u*np.pi/2)
y=x*g_dry[:,None]+wet*g_wet[:,None]
# progressively darker tail (time-varying one-pole lowpass)
fc=np.where(t<FS,18000,18000*np.exp(-u*3.2))
a=np.exp(-2*np.pi*fc/SR)
z=np.zeros(2); out_=np.empty_like(y)
for i in range(n):
    z=(1-a[i])*y[i]+a[i]*z; out_[i]=z
y=out_
# tiny fade-in, final fade to true silence
fi=np.sin(np.clip(t/FI,0,1)*np.pi/2)**2; fo=np.clip((DUR-t)/0.35,0,1)**2
y*=(fi*fo)[:,None]
y*=10**(-1/20)/max(1e-6,np.abs(y).max())
subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','-',out],input=y.astype(np.float32).tobytes(),check=True)
print('ok',out,round(n/SR,2))
