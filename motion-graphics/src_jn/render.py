import sys, os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lib import *
from lib import _yy,_xx
import opening as OP
from fx import Canvas,LineLayer,Cam,star4,ob
from opening import rose,vine,leafp,catmull,starburst,petal_p,CRIM,CRIM_L,CRIM_D,WHT,ROSE_P,BLK,SILV
from PIL import Image, ImageDraw, ImageFont
import subprocess, multiprocessing as mp
K=2; DUR=12.0; N=int(DUR*FPS)
FRAME_C=np.array([0.88,0.80,0.84],np.float32); GLOW_C=np.array([0.85,0.10,0.18],np.float32)
T1,T2,T3,T4,T5=3.2,3.9,5.4,6.9,8.4
def font(path,size,var=None):
    f=ImageFont.truetype(path,size)
    if var:
        try: f.set_variation_by_name(var)
        except Exception: pass
    return f
F_EN=font(S+'fonts/Cinzel.ttf',150,'Bold'); F_KR=font(S+'fonts/suite/SUITE-Medium.ttf',44); F_EP=font(S+'fonts/suite/SUITE-SemiBold.ttf',30)
def text_mask(txt,f,spacing):
    widths=[f.getbbox(c)[2]-f.getbbox(c)[0] for c in txt]; total=sum(widths)+spacing*(len(txt)-1)
    m=Image.new('L',(FW,400),0); d=ImageDraw.Draw(m); x=(FW-total)/2
    for c,w in zip(txt,widths):
        b=f.getbbox(c); d.text((x-b[0],200-(b[1]+b[3])/2),c,font=f,fill=255); x+=w+spacing
    return np.asarray(m).astype(np.float32)/255
def text_plain(txt,f):
    m=Image.new('L',(FW,400),0); ImageDraw.Draw(m).text((FW/2,200),txt,font=f,fill=255,anchor='mm')
    return np.asarray(m).astype(np.float32)/255
def band_at(m,cy):
    b=np.zeros((FH,FW),np.float32); y0=cy-200; y1=min(FH,y0+400); b[y0:y1]=m[:y1-y0]; return b
def grad_fill(m,c1,c2,c3):
    nz=np.where(m.max(1)>0)[0]
    if len(nz)==0: return np.zeros(m.shape+(3,),np.float32)
    y0,y1=nz[0],nz[-1]+1; g=np.clip((np.arange(m.shape[0])-y0)/max(1,y1-y0),0,1)[:,None,None]
    c1,c2,c3=[np.array(c,np.float32) for c in (c1,c2,c3)]
    return np.where(g<0.55,c1+(c2-c1)*(g/0.55),c2+(c3-c2)*((g-0.55)/0.45))*m[...,None]
def frame_layer(t_rel):
    ll=LineLayer(); p=eout(t_rel/1.1,3)
    if p<=0: return ll.f()
    for inset,th in ((40,2),(54,1)):
        x0,y0,x1,y1=inset,inset,FW-inset,FH-inset
        for (ax,ay,bx,by) in ((x0,y0,x1,y0),(x1,y0,x1,y1),(x1,y1,x0,y1),(x0,y1,x0,y0)):
            mx,my=(ax+bx)/2,(ay+by)/2
            for (sx_,sy_) in ((ax,ay),(bx,by)): ll.line((sx_,sy_),(sx_+(mx-sx_)*p,sy_+(my-sy_)*p),th)
    k=eout((t_rel-0.5)/0.6)
    if k>0:
        for (x,y,sx_,sy_) in ((40,40,1,1),(FW-40,40,-1,1),(40,FH-40,1,-1),(FW-40,FH-40,-1,-1)):
            d=14*k; ll.fill([(x,y-d),(x+d,y),(x,y+d),(x-d,y)])
            L=70*k; o=26
            ll.line((x+sx_*o,y+sy_*o),(x+sx_*(o+L),y+sy_*o)); ll.line((x+sx_*o,y+sy_*o),(x+sx_*o,y+sy_*(o+L)))
            for j in range(1,4):   # little thorns on the brackets
                tx=x+sx_*(o+j*L/4); ll.fill([(tx-3,y+sy_*o),(tx+3,y+sy_*o),(tx+sx_*4,y+sy_*(o+9))])
        d=9*k; x,y=FW//2,FH-40; ll.fill([(x,y-d),(x+d,y),(x,y+d),(x-d,y)])
    return ll.f()
def flash(t,tb,w=0.08,k=1.0): return k*math.exp(-((t-tb)/w)**2)
def affine(cx,cy,scale,rot,sx,sy):
    M=cv2.getRotationMatrix2D((sx,sy),rot,scale); M[0,2]+=cx-sx; M[1,2]+=cy-sy; return M
def xf(M,x,y): return M[0,0]*x+M[0,1]*y+M[0,2], M[1,0]*x+M[1,1]*y+M[1,2]
def place_M(layer,M): return cv2.warpAffine(layer,M,(FW,FH),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
def shot_char(t):
    if t<T3:
        u=(t-T2)/(T3-T2); e=eio(u)
        fx,fy=620+(667-620)*e,1490+(860-1490)*e; sc=1.22-0.06*e+0.06*(1-eout(u*4)); rot=-5+4*e; cy=FH*0.5
    elif t<T4:
        u=(t-T3)/(T4-T3); e=eio(u)
        fx,fy=1010-10*e,760+220*e; sc=1.40-0.08*e+0.06*(1-eout(u*4)); rot=9-5*e; cy=FH*0.5
    elif t<T5:
        u=(t-T4)/(T5-T4); e=eio(u)
        fx,fy=648,165+30*e; sc=1.56-0.20*e+0.05*(1-eout(u*4)); rot=-2+2*e; cy=FH*0.47
    else:
        u=(t-T5)/(DUR-T5-0.6); e=eout(u,3)
        fx,fy=648+(616-648)*e,420+(816-420)*e; sc=1.05+(0.58-1.05)*e; rot=0; cy=FH*0.5+(1207-FH*0.5)*e
    return affine(FW/2,cy,sc,rot,fx*K,fy*K)
SCR=Cam(0,0,1,0)
FV=[catmull([(-30,1960),(90,1650),(40,1350),(150,1080),(60,820),(130,600)]),
    catmull([(1110,1960),(990,1640),(1050,1330),(930,1060),(1020,800),(950,560)])]
FR=[(0,(70,1370,95,0.0)),(0,(130,1020,70,0.15)),(0,(95,690,55,0.3)),(1,(1010,1300,100,0.08)),(1,(950,980,72,0.22)),(1,(1000,700,56,0.36))]
rng=np.random.default_rng(51)
FALL=[dict(x=rng.uniform(0,FW),y=rng.uniform(-200,FH),v=rng.uniform(40,110),s=rng.uniform(9,20),ph=rng.uniform(0,6.3),
           sp=rng.uniform(-2,2),fg=rng.random()<0.2) for _ in range(44)]
def glints(t,M,pts,col,cv,size=38):
    return   # star glints removed on request
    for (gx,gy,ph) in pts:
        k=max(0,math.sin(t*3.0+ph*6))**6
        if k>0.03:
            x,y=xf(M,gx*K,gy*K); star4(cv,np.array([x,y]),size*(0.5+0.5*k),tuple(c*k for c in col))
BGCAM=Cam(FW/2,FH*0.5-60,1.0,0.0)
_cr=np.asarray(Image.open(S+'jn/crest.png').convert('RGBA')).astype(np.float32)/255
_cr[...,:3]*=_cr[...,3:4]          # premultiply
CREST=_cr; CREST_SIZE=190; CREST_Y=160
def render(f):
    t=f/FPS
    if t<T2: return to8(OP.opening(t,T1,T2))
    fin=t>=T5
    img=OP.background(t,BGCAM)
    img*=0.55 if not fin else 0.75
    ch=char_frame(t); M=shot_char(t)
    if fin:
        tr=t-T5; e=eout(tr/(DUR-T5-0.6),3)
        sb=Canvas(); starburst(sb,Cam(FW/2,FH*0.36,1.0,0),190,clamp(tr/0.9),0.04*t); sb.comp(img,0.55)
        fl=Canvas()
        for i,V in enumerate(FV): vine(fl,SCR,V,eout((tr-0.1-i*0.08)/1.2,2),26)
        for side,(x,y,R,d) in FR: rose(fl,SCR,x,y,R,T5+0.6+d,t,0.0,small=R<80,fill=WHT if R>=80 else (0.62,0.06,0.12),gap=(0.12,0.01,0.03),rim=(1.0,0.30,0.38))
        for p_ in FALL:
            if p_['fg']: continue
            y=(p_['y']+p_['v']*t)%(FH+200)-100; x=p_['x']+30*math.sin(t*0.9+p_['ph'])
            petal_p(fl,SCR,x,y,p_['s'],p_['sp']*t,idx=int(p_['ph']*10))
        fl.comp(img,eout(tr/0.4))
    else:
        add(img,particles(t,0.45,(0,-40*t)))
    L=place_M(ch,M)
    add(img,glow(L,24,0.10)); add(img,cv2.GaussianBlur(L[...,3],(0,0),26)[...,None]*GLOW_C*0.10)
    over(img,L)
    fx_=Canvas()
    if T2<=t<T3:   glints(t-T2,M,[(450,1545,0.0),(760,1455,0.45),(880,1520,0.25),(667,800,0.7)],(1,0.95,0.95),fx_)
    elif T3<=t<T4: glints(t-T3,M,[(1013,993,0.0),(1027,1067,0.45),(1053,700,0.7),(960,1240,0.2)],(1,0.95,0.95),fx_)
    elif T4<=t<T5:
        glints(t-T4,M,[(596,120,0.0),(680,440,0.5)],(1,0.95,0.95),fx_)
        glints(t-T4,M,[(684,217,0.25)],(1.0,0.25,0.30),fx_,30)
    la=fx_.rgb.astype(np.float32)/255; img+=la+cv2.GaussianBlur(la,(0,0),6)*1.4
    if fin:
        tr=t-T5
        fg=Canvas()
        for p_ in FALL:
            if not p_['fg']: continue
            y=(p_['y']+p_['v']*1.8*t)%(FH+200)-100; x=p_['x']+40*math.sin(t*0.7+p_['ph'])
            petal_p(fg,SCR,x,y,p_['s']*2.4,p_['sp']*t,idx=int(p_['ph']*10))
        fg.comp(img,0.85*eout(tr/0.6),blur=6)
        spk=Canvas()
        for s_ in OP.SPK:
            k=max(0,math.sin(t*s_['sp']+s_['ph']))**3
            if k>0.02: star4(spk,np.array([s_['x'],s_['y']]),s_['L']*(0.6+0.4*k),tuple(c*k for c in s_['c']))
        la=spk.rgb.astype(np.float32)/255; img+=(la+cv2.GaussianBlur(la,(0,0),5))*eout(tr/0.8)
        fm=frame_layer(tr-0.5); img+=fm[...,None]*FRAME_C*0.95+cv2.GaussianBlur(fm,(0,0),4)[...,None]*GLOW_C*0.9
        g=np.clip((_yy-FH*0.68)/(FH*0.32),0,1)[...,None]**1.4
        img*=1-0.78*g*eout(tr/1.2)
        ke=eout((tr-1.0)/0.8)
        if ke>0:
            # Jin's feathered skull crest (from the supplied SVG), pops in with overshoot + a silver sheen
            sz=CREST_SIZE*ob((tr-1.0)/0.55,1.4)
            if sz>2:
                M=cv2.getRotationMatrix2D((CREST.shape[1]/2,CREST.shape[0]/2),0,sz/CREST.shape[1])
                M[0,2]+=FW/2-CREST.shape[1]/2; M[1,2]+=CREST_Y-CREST.shape[0]/2
                cr=cv2.warpAffine(CREST,M,(FW,FH),flags=cv2.INTER_AREA,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
                ca=cr[...,3]*ke; crgb=cr[...,:3]
                su=(tr-1.6)/0.7
                if 0<su<1:
                    band=np.exp(-((_xx-(FW/2-CREST_SIZE+su*2*CREST_SIZE))+(_yy-CREST_Y)*0.6)**2/(2*18**2))
                    crgb=crgb+band[...,None]*0.55*cr[...,3:4]
                img+=cv2.GaussianBlur(ca,(0,0),14)[...,None]*GLOW_C*0.55
                img[...]=img*(1-ca[...,None])+crgb*ca[...,None]
        kt=eout((tr-1.3)/1.1,3)
        if kt>0:
            sp=int((150-100*kt)*0.9)
            band=band_at(text_mask('JIN',F_EN,sp),1590)
            col=grad_fill(band,(1.0,0.98,0.98),(0.78,0.74,0.78),(0.96,0.92,0.94))
            img+=cv2.GaussianBlur(band,(0,0),16)[...,None]*GLOW_C*1.1*kt
            over(img,np.dstack([col*kt,band*kt]))
            su=(tr-2.5)/0.8
            if 0<su<1:
                sh=np.exp(-((_xx-(-200+su*1480)+(_yy-1590)*0.4)/60)**2)*band
                add(img,sh[...,None]*np.array([1,0.95,0.95]),0.8)
        kk=eout((tr-1.9)/0.9)
        if kk>0:
            dv=LineLayer(); y=1694; w=260*kk
            dv.line((FW/2-w,y),(FW/2-26,y)); dv.line((FW/2+26,y),(FW/2+w,y)); dv.fill([(FW/2,y-9),(FW/2+9,y),(FW/2,y+9),(FW/2-9,y)])
            m=dv.f(); img+=m[...,None]*FRAME_C+cv2.GaussianBlur(m,(0,0),4)[...,None]*GLOW_C
            b1=band_at(text_plain('에피소드 1',F_EP),1742)
            over(img,np.dstack([grad_fill(b1,(1.0,0.62,0.66),(0.88,0.22,0.30),(1.0,0.55,0.60))*kk,b1*kk]))
            k2=eout((tr-2.2)/0.9)
            if k2>0:
                b2=band_at(text_plain('죽음의 도시와 괴도',F_KR),1806)
                img+=cv2.GaussianBlur(b2,(0,0),8)[...,None]*GLOW_C*0.45*k2
                over(img,np.dstack([np.ones((FH,FW,3),np.float32)*np.array([0.98,0.96,0.96],np.float32)*(b2*k2)[...,None],b2*k2]))
    fl=flash(t,T2,0.12,1.2)+flash(t,T3,0.07,0.9)+flash(t,T4,0.07,0.9)+flash(t,T5,0.09,1.0)
    img+=fl*np.array([1.0,0.90,0.90],np.float32)
    return to8(img)
if __name__=='__main__':
    only=sys.argv[1:]
    if only:
        for f in map(int,only): Image.fromarray(render(f)).save(S+f'output/jn_pv_{f:03d}.png')
        sys.exit()
    out=S+'output/jin_motion.mp4'
    p=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{FW}x{FH}','-r',str(FPS),'-i','-',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','15','-preset','slow','-tune','animation','-movflags','+faststart',out],stdin=subprocess.PIPE)
    with mp.get_context('fork').Pool(3) as pool:
        for i,fr in enumerate(pool.imap(render,range(N),chunksize=2)):
            p.stdin.write(fr.tobytes())
            if i%30==0: print(i,flush=True)
    p.stdin.close(); p.wait(); print('done',out)
