import sys, os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lib import *
from lib import _yy,_xx
import opening as OP
from opening import Cv,emblem,glitch,stage,eq_bars,rrect,note,NOTES,PINK,GREEN,WHT,PINK_D,GRN_D
from PIL import Image, ImageDraw, ImageFont
import subprocess, multiprocessing as mp
K=2; DUR=12.0; N=int(DUR*FPS)
T1,T2,T3,T4,T5=3.25,4.0,5.5,7.0,8.5
F_EN=ImageFont.truetype(S+'fonts/Bungee-Regular.ttf',132)
F_KR=ImageFont.truetype(S+'fonts/suite/SUITE-Medium.ttf',44); F_EP=ImageFont.truetype(S+'fonts/suite/SUITE-SemiBold.ttf',30)
def text_plain(txt,f,spacing=None):
    m=Image.new('L',(FW,400),0); ImageDraw.Draw(m).text((FW/2,200),txt,font=f,fill=255,anchor='mm')
    return np.asarray(m).astype(np.float32)/255
def band_at(m,cy):
    b=np.zeros((FH,FW),np.float32); y0=cy-200; y1=min(FH,y0+400); b[y0:y1]=m[:y1-y0]; return b
def affine(cx,cy,scale,rot,sx,sy):
    M=cv2.getRotationMatrix2D((sx,sy),rot,scale); M[0,2]+=cx-sx; M[1,2]+=cy-sy; return M
def xf(M,x,y): return M[0,0]*x+M[0,1]*y+M[0,2], M[1,0]*x+M[1,1]*y+M[1,2]
def place_M(layer,M): return cv2.warpAffine(layer,M,(FW,FH),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
def shot_char(t):
    b=beat_env(t)
    if t<T3:
        u=(t-T2)/(T3-T2); e=eio(u)
        fx,fy=800+(700-800)*e,1480+(1020-1480)*e; sc=1.22-0.05*e; rot=-6+4*e; cy=FH*0.5
    elif t<T4:
        u=(t-T3)/(T4-T3); e=eio(u)
        fx,fy=400+160*e,830-90*e; sc=1.32-0.06*e; rot=-18+6*e; cy=FH*0.5
    elif t<T5:
        u=(t-T4)/(T5-T4); e=eio(u)
        fx,fy=600,200+40*e; sc=1.50-0.18*e; rot=-2+2*e; cy=FH*0.47
    else:
        u=(t-T5)/(DUR-T5-0.6); e=eout(u,3)
        fx,fy=605+(616-605)*e,420+(816-420)*e; sc=1.05+(0.60-1.05)*e; rot=0; cy=FH*0.5+(1235-FH*0.5)*e
    sc*=1+0.025*b
    return affine(FW/2,cy-16*b,sc,rot,fx*K,fy*K)
def frame_neon(tr,env):
    cv=Cv(); gl=Cv(); p=eout(tr/1.1,3)
    for inset,col,th in ((34,PINK,4),(50,GREEN,2)):
        pts=rrect(FW-2*inset,FH-2*inset,40)+inset; n=int(len(pts)*p)
        if n>1: cv.lines(pts[:n],col,th,n==len(pts)); gl.lines(pts[:n],col,th*3,n==len(pts))
    k=eout((tr-0.5)/0.6)
    if k>0:
        for (x,y,sx,sy) in ((76,76,1,1),(FW-76,76,-1,1),(76,FH-76,1,-1),(FW-76,FH-76,-1,-1)):
            d=16*k; cv.poly([(x,y-d),(x+d,y),(x,y+d),(x-d,y)],PINK); gl.poly([(x,y-d),(x+d,y),(x,y+d),(x-d,y)],PINK)
            cv.lines([(x+sx*26,y),(x+sx*(26+110*k),y)],GREEN,3); cv.lines([(x,y+sy*26),(x,y+sy*(26+110*k))],GREEN,3)
        for (x,y) in ((FW/2,34),(FW/2,FH-34)):
            d=12*k; cv.poly([(x,y-d),(x+d*1.6,y),(x,y+d),(x-d*1.6,y)],GREEN); gl.poly([(x,y-d),(x+d*1.6,y),(x,y+d),(x-d*1.6,y)],GREEN)
    r,a=cv.f(); g,_=gl.f(); return r,a,g*(0.7+0.8*env)
def chroma_title(img,band,k,tr,seed):
    d=int(6+40*(1-k)); 
    pink=np.roll(band,-d,axis=1); grn=np.roll(band,d,axis=1)
    img+=pink[...,None]*np.array(PINK,np.float32)*0.85*k+grn[...,None]*np.array(GREEN,np.float32)*0.85*k
    img+=cv2.GaussianBlur(band,(0,0),16)[...,None]*np.array(PINK,np.float32)*0.6*k
    main=band.copy()
    if k<1:
        rng=np.random.default_rng(seed)
        for _ in range(8):
            y0=int(rng.integers(1440,1600)); h=int(rng.integers(6,30)); main[y0:y0+h]=np.roll(main[y0:y0+h],int(rng.uniform(-90,90)*(1-k)),axis=1)
    img[...]=img*(1-main[...,None]*k)+main[...,None]*np.array(WHT,np.float32)*k
def render(f):
    t=f/FPS
    if t<T2: return to8(OP.opening(t,T1,T2))
    fin=t>=T5; env=beat_env(t)
    img=stage(t,env,0.55 if not fin else 0.8)
    ch=char_frame(t); M=shot_char(t)
    if fin:
        tr=t-T5
        em=Cv(); gl=Cv(); Cc=(FW/2,FH*0.38); S_=440*(1+0.04*env)
        emblem(em,Cc,S_,clamp(tr/0.9),th=6); emblem(gl,Cc,S_,clamp(tr/0.9),th=16)
        er,ea=em.f(); gr,_=gl.f(); k=eout(tr/0.6)
        img+=cv2.GaussianBlur(gr,(0,0),14)*0.5*k*(0.6+0.8*env); OP.over(img,er*0.55,ea*0.55*k)
        nc=Cv()
        for n_ in NOTES:
            y=(n_['y']-n_['v']*t)%(FH*1.2)-60; x=n_['x']+30*math.sin(t*1.4+n_['ph'])
            note(nc,x,y,n_['s']*(1+0.2*env),n_['c'],0.2*math.sin(t*2+n_['ph']))
        nr,na=nc.f(); img+=cv2.GaussianBlur(nr,(0,0),6)*0.6*k; OP.over(img,nr,na*k)
    else:
        add(img,particles(t,0.5,(0,-60*t)))
    L=place_M(ch,M)
    img+=cv2.GaussianBlur(L[...,3],(0,0),26)[...,None]*np.array(PINK,np.float32)*(0.10+0.12*env)
    over(img,L)
    if T3<=t<T4:   # sound rings from the pickups on each beat
        rl=Cv()
        for (gx,gy) in ((413,787),(507,753)):
            x,y=xf(M,gx*K,gy*K); ph=(t%0.5)/0.5
            for j in range(2):
                q=(ph+j*0.5)%1.0; rl.circle((x,y),40+520*q,PINK if j==0 else GREEN,max(1,8*(1-q)))
        rr,_=rl.f(); img+=rr*0.6+cv2.GaussianBlur(rr,(0,0),6)*0.8
    if fin:
        tr=t-T5
        er,ea=eq_bars(t,env,FH,eout(tr/0.6)*0.55,n=32,hmax=200); img+=cv2.GaussianBlur(er,(0,0),8)*0.4; OP.over(img,er,ea)
        fr,fa,fg=frame_neon(tr-0.5,env); img+=cv2.GaussianBlur(fg,(0,0),10)*0.8; OP.over(img,fr,fa)
        g=np.clip((_yy-FH*0.70)/(FH*0.30),0,1)[...,None]**1.4
        img*=1-0.72*g*eout(tr/1.2)
        ke=eout((tr-1.0)/0.8)
        if ke>0:
            e2=Cv(); g2=Cv(); emblem(e2,(FW/2,150),64*(1+0.08*env),ke,th=3,fill=True); emblem(g2,(FW/2,150),64,ke,th=8)
            r2,a2=e2.f(); gg,_=g2.f(); img+=cv2.GaussianBlur(gg,(0,0),8)*0.9; OP.over(img,r2,a2)
        kt=eout((tr-1.3)/0.5,2)
        if kt>0:
            band=band_at(text_plain('RAMUNE',F_EN),1590)
            chroma_title(img,band,kt,tr,int(t*30))
        kk=eout((tr-1.9)/0.7)
        if kk>0:
            dv=Cv(); y=1694; w=260*kk
            dv.lines([(FW/2-w,y),(FW/2-26,y)],GREEN,2); dv.lines([(FW/2+26,y),(FW/2+w,y)],PINK,2)
            dv.poly([(FW/2,y-9),(FW/2+9,y),(FW/2,y+9),(FW/2-9,y)],WHT)
            dr,da=dv.f(); img+=cv2.GaussianBlur(dr,(0,0),4); OP.over(img,dr,da)
            b1=band_at(text_plain('에피소드 4',F_EP),1742)
            img+=cv2.GaussianBlur(b1,(0,0),6)[...,None]*np.array(GREEN,np.float32)*0.6*kk
            img[...]=img*(1-b1[...,None]*kk)+b1[...,None]*np.array(GREEN,np.float32)*kk
            k2=eout((tr-2.2)/0.7)
            if k2>0:
                b2=band_at(text_plain('리듬으로 돌아가줘!',F_KR),1806)
                img+=cv2.GaussianBlur(b2,(0,0),8)[...,None]*np.array(PINK,np.float32)*0.55*k2
                img[...]=img*(1-b2[...,None]*k2)+b2[...,None]*np.array(WHT,np.float32)*k2
    vig=np.clip(1-(np.hypot((_xx-FW/2)/FW,(_yy-FH/2)/FH)**2)*1.0,0.4,1)[...,None]; img*=vig
    # glitch cuts + small glitch on downbeats
    gk=max(math.exp(-((t-tb)/0.07)**2)*1.2 for tb in (T2,T3,T4,T5))
    if not fin and int(round(t/0.5))%2==0: gk=max(gk,max(0,env-0.55)*0.8)
    if fin and int(round(t/0.5))%4==0: gk=max(gk,max(0,env-0.7)*0.5)
    img=glitch(img,gk,f*13+5)
    img+=max(math.exp(-((t-tb)/0.05)**2) for tb in (T3,T4,T5))*0.5*np.array([1.0,0.5,0.85],np.float32)
    return to8(img)
if __name__=='__main__':
    only=sys.argv[1:]
    if only:
        for f in map(int,only): Image.fromarray(render(f)).save(S+f'output/rm_pv_{f:03d}.png')
        sys.exit()
    out=S+'output/ramune_motion.mp4'
    p=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{FW}x{FH}','-r',str(FPS),'-i','-',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','15','-preset','slow','-tune','animation','-movflags','+faststart',out],stdin=subprocess.PIPE)
    with mp.get_context('fork').Pool(3) as pool:
        for i,fr in enumerate(pool.imap(render,range(N),chunksize=2)):
            p.stdin.write(fr.tobytes())
            if i%30==0: print(i,flush=True)
    p.stdin.close(); p.wait(); print('done',out)
