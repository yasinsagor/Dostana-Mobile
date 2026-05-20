import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { supabase, fetchBranchWorkers, saveBranchWorkers } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

/* ─── helpers ──────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().slice(0,10); }
function timeAgo(iso) {
  if (!iso) return 'Never';
  const diff = Math.floor((Date.now()-new Date(iso))/60000);
  if (diff<1) return 'just now'; if (diff<60) return diff+'m ago';
  const h=Math.floor(diff/60); if(h<24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}

/* ─── reusable section header ──────────────────────────────── */
function SH({ icon, title, sub, open, onPress, color='#333' }) {
  return (
    <TouchableOpacity style={[sh.row,{borderLeftColor:color}]} onPress={onPress} activeOpacity={0.7}>
      <View style={[sh.iconBox,{backgroundColor:color+'18'}]}>
        <Text style={{fontSize:18}}>{icon}</Text>
      </View>
      <View style={{flex:1}}>
        <Text style={[sh.title,{color}]}>{title}</Text>
        {sub?<Text style={sh.sub}>{sub}</Text>:null}
      </View>
      <Text style={sh.chevron}>{open?'▲':'▼'}</Text>
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',backgroundColor:'#fff',padding:14,borderRadius:14,marginBottom:2,borderLeftWidth:4,shadowColor:'#000',shadowOpacity:0.04,shadowRadius:3,elevation:2,gap:12},
  iconBox:{width:38,height:38,borderRadius:10,alignItems:'center',justifyContent:'center'},
  title:{fontSize:14,fontWeight:'800',color:'#333'},
  sub:{fontSize:11,color:'#aaa',marginTop:1},
  chevron:{fontSize:12,color:'#bbb'},
});

/* ─── setting row (label + control) ───────────────────────── */
function SettingRow({ label, sub, value, onPress, type='nav', color='#333' }) {
  return (
    <TouchableOpacity style={sr.row} onPress={onPress} activeOpacity={type==='nav'?0.7:1}>
      <View style={{flex:1}}>
        <Text style={sr.label}>{label}</Text>
        {sub?<Text style={sr.sub}>{sub}</Text>:null}
      </View>
      {type==='nav'&&<Text style={sr.val}>{value?<Text style={sr.valTxt}>{value}</Text>:null} <Text style={sr.arrow}>›</Text></Text>}
      {type==='badge'&&<View style={[sr.badge,{backgroundColor:color+'22'}]}><Text style={[sr.badgeTxt,{color}]}>{value}</Text></View>}
    </TouchableOpacity>
  );
}
const sr = StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#F5F5F5',gap:8},
  label:{fontSize:13,fontWeight:'700',color:'#222'},
  sub:{fontSize:11,color:'#aaa',marginTop:2},
  val:{fontSize:13,color:'#aaa'},
  valTxt:{color:'#aaa'},
  arrow:{fontSize:16,color:'#ccc'},
  badge:{borderRadius:8,paddingHorizontal:10,paddingVertical:3},
  badgeTxt:{fontSize:11,fontWeight:'700'},
});

/* ─── action button ────────────────────────────────────────── */
function ActBtn({ icon, label, sub, onPress, color='#1565C0', bg='#E3F2FD' }) {
  return (
    <TouchableOpacity style={[ab.btn,{backgroundColor:bg}]} onPress={onPress} activeOpacity={0.75}>
      <Text style={{fontSize:18}}>{icon}</Text>
      <View style={{flex:1}}>
        <Text style={[ab.label,{color}]}>{label}</Text>
        {sub?<Text style={ab.sub}>{sub}</Text>:null}
      </View>
      <Text style={[ab.arrow,{color:color+'99'}]}>›</Text>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  btn:{flexDirection:'row',alignItems:'center',borderRadius:12,padding:13,marginBottom:6,gap:12},
  label:{fontSize:13,fontWeight:'700'},
  sub:{fontSize:11,color:'#999',marginTop:1},
  arrow:{fontSize:16},
});

/* ─── toggle row ───────────────────────────────────────────── */
function ToggleRow({ icon, label, sub, value, onChange }) {
  return (
    <View style={tr.row}>
      <Text style={{fontSize:16,width:26}}>{icon}</Text>
      <View style={{flex:1}}>
        <Text style={tr.label}>{label}</Text>
        {sub?<Text style={tr.sub}>{sub}</Text>:null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{true:COLORS.primary,false:'#ddd'}} thumbColor='#fff'/>
    </View>
  );
}
const tr = StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#F5F5F5',gap:10},
  label:{fontSize:13,fontWeight:'700',color:'#222'},
  sub:{fontSize:11,color:'#aaa',marginTop:1},
});

/* ─── permission chip ──────────────────────────────────────── */
function PermChip({ label, enabled, onToggle }) {
  return (
    <TouchableOpacity
      style={[pc.chip,enabled?pc.on:pc.off]}
      onPress={onToggle} activeOpacity={0.8}>
      <Text style={[pc.txt,{color:enabled?'#fff':COLORS.primary}]}>{label}</Text>
    </TouchableOpacity>
  );
}
const pc = StyleSheet.create({
  chip:{paddingHorizontal:11,paddingVertical:6,borderRadius:20,borderWidth:1.5,margin:3},
  on:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},
  off:{backgroundColor:'#fff',borderColor:COLORS.primary+'60'},
  txt:{fontSize:11,fontWeight:'700'},
});

/* ─── SPEC product categories ──────────────────────────────── */
const SPEC_PRODUCTS = [
  { id:1, cat:'Meat',      name:'Chicken',     unit:'kg',     price:25 },
  { id:2, cat:'Meat',      name:'Lamb',        unit:'kg',     price:50 },
  { id:3, cat:'Bread',     name:'Pita',        unit:'packs',  price:8  },
  { id:4, cat:'Bread',     name:'Kebab Bread', unit:'packs',  price:7  },
  { id:5, cat:'Sauces',    name:'Garlic Sauce',unit:'bottles',price:12 },
  { id:6, cat:'Sauces',    name:'Chili Sauce', unit:'bottles',price:11 },
  { id:7, cat:'Vegetables',name:'Tomatoes',    unit:'kg',     price:4  },
  { id:8, cat:'Vegetables',name:'Lettuce',     unit:'kg',     price:3  },
  { id:9, cat:'Packaging', name:'Boxes',       unit:'packs',  price:15 },
  { id:10,cat:'Packaging', name:'Napkins',     unit:'packs',  price:5  },
];

const catColors = { Meat:'#D32F2F', Bread:'#F57C00', Sauces:'#7B1FA2', Vegetables:'#388E3C', Packaging:'#0288D1' };

/* ════════════════════════════════════════════════════════════ */
export default function OwnerSettingsScreen() {
  const { logout } = useAuth();

  /* toggles */
  const [notifMissing,  setNotifMissing]  = useState(true);
  const [notifSpec,     setNotifSpec]     = useState(true);
  const [notifCF,       setNotifCF]       = useState(true);
  const [notifExpense,  setNotifExpense]  = useState(true);
  const [darkMode,      setDarkMode]      = useState(false);

  /* manager permissions state (per-branch) */
  const [perms, setPerms] = useState(() =>
    Object.fromEntries(BRANCHES.map(b=>[b.name,{edit:true,delete:false,export:false,addProduct:false}]))
  );
  const togglePerm = (branch,key) =>
    setPerms(p=>({...p,[branch]:{...p[branch],[key]:!p[branch][key]}}));

  /* db state */
  const [dbStatus, setDbStatus] = useState('unknown');
  const [lastSync,  setLastSync]  = useState(null);
  const [syncing,   setSyncing]   = useState(false);

  /* financial settings */
  const [laborRate,   setLaborRate]   = useState('22');
  const [deliveryPct, setDeliveryPct] = useState('8');
  const [taxPct,      setTaxPct]      = useState('23');

  /* analytics thresholds */
  const [foodWarn,   setFoodWarn]   = useState('12');
  const [laborWarn,  setLaborWarn]  = useState('25');
  const [profitWarn, setProfitWarn] = useState('8');

  /* workers management */
  const [workerBranch,   setWorkerBranch]   = useState(BRANCHES[0]?.name || '');
  const [workerList,     setWorkerList]      = useState([]);
  const [workerLoading,  setWorkerLoading]   = useState(false);
  const [newWorkerName,  setNewWorkerName]   = useState('');
  const [workerSaving,   setWorkerSaving]    = useState(false);

  const loadWorkers = useCallback(async (branch) => {
    setWorkerLoading(true);
    try {
      const { data } = await supabase
        .from('branch_workers')
        .select('id, name, active')
        .eq('branch', branch)
        .order('name');
      setWorkerList(data || []);
    } catch { setWorkerList([]); }
    setWorkerLoading(false);
  }, []);

  const addWorker = async () => {
    const name = newWorkerName.trim();
    if (!name) return;
    setWorkerSaving(true);
    try {
      const { data, error } = await supabase
        .from('branch_workers')
        .upsert({ branch: workerBranch, name, active: true }, { onConflict: 'branch,name' })
        .select().single();
      if (error) throw error;
      setNewWorkerName('');
      loadWorkers(workerBranch);
    } catch (e) { Alert.alert('Error', e.message); }
    setWorkerSaving(false);
  };

  const toggleWorker = async (worker) => {
    try {
      await supabase.from('branch_workers').update({ active: !worker.active }).eq('id', worker.id);
      setWorkerList(p => p.map(w => w.id === worker.id ? { ...w, active: !w.active } : w));
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const deleteWorker = (worker) => {
    Alert.alert('Remove Worker', `Remove ${worker.name} from ${workerBranch}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('branch_workers').delete().eq('id', worker.id);
          setWorkerList(p => p.filter(w => w.id !== worker.id));
        } catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  /* open/close accordion */
  const [open, setOpen] = useState({
    branches:false, managers:false, workers:false, spec:false,
    notif:false, financial:false, analytics:false,
    app:false, db:false, security:false, sysinfo:false,
  });
  const tog = k => setOpen(p=>({...p,[k]:!p[k]}));
  const soon = (f='') => Alert.alert('Coming Soon', (f?`${f} — `:'')+'This feature will be available in the next update.');

  /* test db connection */
  const testConnection = useCallback(async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.from('daily_reports').select('id').limit(1);
      setDbStatus(error ? 'error' : 'connected');
      setLastSync(new Date().toISOString());
      Alert.alert(error?'Connection Failed':'Connected', error?`Error: ${error.message}`:'Supabase is reachable and responding.');
    } catch(e) {
      setDbStatus('error');
      Alert.alert('Error', 'Could not reach Supabase.');
    }
    setSyncing(false);
  }, []);

  const handleLogout = () =>
    Alert.alert('Log Out','Are you sure you want to log out?',[
      {text:'Cancel',style:'cancel'},
      {text:'Log Out',style:'destructive',onPress:logout},
    ]);

  const Body = ({children}) => <View style={s.sectionBody}>{children}</View>;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.pageHeader}>
        <View style={{flex:1}}>
          <Text style={s.pageTitle}>⚙️ Settings</Text>
          <Text style={s.pageSub}>Configuration, permissions & system controls</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutTxt}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* ── 1. BRANCH SETTINGS ───────────────────────────── */}
        <SH icon="🏪" title="Branch Settings" sub="Names, hours, active status, assignments"
          color={COLORS.primary} open={open.branches} onPress={()=>tog('branches')}/>
        {open.branches&&(
          <Body>
            <ActBtn icon="➕" label="Add New Branch" sub="Register a new Dostana location"
              color={COLORS.primary} bg="#E8F5E9" onPress={()=>soon('Add Branch')}/>
            <ActBtn icon="✏️" label="Edit Branch Details" sub="Name, address, opening hours"
              color={COLORS.primary} bg="#E8F5E9" onPress={()=>soon('Edit Branch')}/>
            <ActBtn icon="🚫" label="Disable / Deactivate Branch" sub="Temporarily remove from reports"
              color="#D32F2F" bg="#FFEBEE" onPress={()=>soon('Disable Branch')}/>
            <View style={s.divider}/>
            <Text style={s.subheading}>All Branches</Text>
            {BRANCHES.map((b,i)=>(
              <TouchableOpacity key={b.name} style={s.branchRow} onPress={()=>soon(`Edit ${b.name}`)} activeOpacity={0.7}>
                <View style={[s.dot,{backgroundColor:COLORS.primary}]}/>
                <View style={{flex:1}}>
                  <Text style={s.branchName}>{b.name}</Text>
                  <Text style={s.branchSub}>PIN: {b.pin} · Active</Text>
                </View>
                <Text style={s.editChip}>Edit ›</Text>
              </TouchableOpacity>
            ))}
          </Body>
        )}

        {/* ── 2. MANAGER SETTINGS ──────────────────────────── */}
        <SH icon="👨‍🍳" title="Manager Settings" sub="PINs, permissions, access control"
          color="#E65100" open={open.managers} onPress={()=>tog('managers')}/>
        {open.managers&&(
          <Body>
            <Text style={s.permNote}>Tap permissions to toggle access for each branch manager.</Text>
            {BRANCHES.map(b=>(
              <View key={b.name} style={s.mgrCard}>
                <View style={{flexDirection:'row',alignItems:'center',marginBottom:8}}>
                  <View style={[s.dot,{backgroundColor:COLORS.primary}]}/>
                  <View style={{flex:1}}>
                    <Text style={s.mgrName}>{b.name}</Text>
                    <Text style={s.mgrSub}>PIN: {b.pin}</Text>
                  </View>
                  <TouchableOpacity style={s.pinResetBtn} onPress={()=>soon(`Reset PIN ${b.name}`)}>
                    <Text style={s.pinResetTxt}>Reset PIN</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.permLabel}>Permissions:</Text>
                <View style={{flexDirection:'row',flexWrap:'wrap',marginTop:4}}>
                  <PermChip label="Edit Reports"   enabled={perms[b.name]?.edit}       onToggle={()=>togglePerm(b.name,'edit')}/>
                  <PermChip label="Delete SPEC"    enabled={perms[b.name]?.delete}     onToggle={()=>togglePerm(b.name,'delete')}/>
                  <PermChip label="Export Reports" enabled={perms[b.name]?.export}     onToggle={()=>togglePerm(b.name,'export')}/>
                  <PermChip label="Add Products"   enabled={perms[b.name]?.addProduct} onToggle={()=>togglePerm(b.name,'addProduct')}/>
                </View>
              </View>
            ))}
          </Body>
        )}

        {/* ── 3. WORKERS MANAGEMENT ────────────────────────── */}
        <SH icon="👷" title="Workers Management" sub="Add, remove and manage staff per branch"
          color="#1565C0" open={open.workers} onPress={()=>{ tog('workers'); if(!open.workers) loadWorkers(workerBranch); }}/>
        {open.workers && (
          <Body>
            {/* Branch selector */}
            <Text style={s.subheading}>Select Branch</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
              <View style={{flexDirection:'row',gap:6,paddingBottom:4}}>
                {BRANCHES.map(b => (
                  <TouchableOpacity key={b.name}
                    style={[s.wBranchChip, workerBranch===b.name && s.wBranchChipActive]}
                    onPress={() => { setWorkerBranch(b.name); loadWorkers(b.name); }}
                    activeOpacity={0.75}>
                    <Text style={[s.wBranchChipTxt, workerBranch===b.name && {color:'#fff'}]}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Add worker */}
            <View style={s.wAddRow}>
              <TextInput
                style={s.wNameInput}
                value={newWorkerName}
                onChangeText={setNewWorkerName}
                placeholder="Worker name..."
                placeholderTextColor="#ccc"
                onSubmitEditing={addWorker}
              />
              <TouchableOpacity style={[s.wAddBtn, workerSaving && {opacity:0.6}]} onPress={addWorker} disabled={workerSaving}>
                {workerSaving ? <ActivityIndicator size="small" color="#fff"/> : <Text style={s.wAddBtnTxt}>+ Add</Text>}
              </TouchableOpacity>
            </View>

            <View style={s.divider}/>

            {/* Worker list */}
            {workerLoading
              ? <ActivityIndicator color="#1565C0" style={{marginVertical:16}}/>
              : workerList.length === 0
                ? <Text style={s.wEmpty}>No workers added for {workerBranch} yet.</Text>
                : workerList.map(w => (
                  <View key={w.id} style={s.wRow}>
                    <View style={[s.dot, {backgroundColor: w.active ? '#43A047' : '#ccc'}]}/>
                    <Text style={[s.wName, !w.active && {color:'#aaa', textDecorationLine:'line-through'}]}>{w.name}</Text>
                    <TouchableOpacity onPress={() => toggleWorker(w)} style={s.wToggleBtn}>
                      <Text style={[s.wToggleTxt, {color: w.active ? '#E65100' : '#43A047'}]}>
                        {w.active ? 'Deactivate' : 'Activate'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteWorker(w)} style={s.wDelBtn}>
                      <Text style={{fontSize:16, color:'#E53935'}}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))
            }
          </Body>
        )}

        {/* ── 4. SPEC SETTINGS ─────────────────────────────── */}
        <SH icon="📦" title="SPEC Settings" sub="Product list, categories, units, pricing"
          color="#6A1B9A" open={open.spec} onPress={()=>tog('spec')}/>
        {open.spec&&(
          <Body>
            <ActBtn icon="➕" label="Add New Product" sub="Name, category, unit, supplier price"
              color="#6A1B9A" bg="#F3E5F5" onPress={()=>soon('Add Product')}/>
            <ActBtn icon="📋" label="Order Templates" sub="Default quantities per branch"
              color="#6A1B9A" bg="#F3E5F5" onPress={()=>soon('Order Templates')}/>
            <ActBtn icon="📅" label="Order Days" sub="Set allowed ordering schedule"
              color="#6A1B9A" bg="#F3E5F5" onPress={()=>soon('Order Days')}/>
            <View style={s.divider}/>
            <Text style={s.subheading}>Current Product List</Text>
            {['Meat','Bread','Sauces','Vegetables','Packaging'].map(cat=>(
              <View key={cat}>
                <Text style={[s.catLabel,{color:catColors[cat]||'#555'}]}>▸ {cat}</Text>
                {SPEC_PRODUCTS.filter(p=>p.cat===cat).map(p=>(
                  <TouchableOpacity key={p.id} style={s.productRow} onPress={()=>soon(`Edit ${p.name}`)} activeOpacity={0.7}>
                    <View style={[s.dot,{backgroundColor:catColors[cat]||'#999'}]}/>
                    <Text style={s.productName}>{p.name}</Text>
                    <Text style={s.productUnit}>{p.unit}</Text>
                    <Text style={s.productPrice}>~{p.price} PLN/{p.unit}</Text>
                    <Text style={s.editSmall}>Edit</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </Body>
        )}

        {/* ── 4. NOTIFICATION SETTINGS ─────────────────────── */}
        <SH icon="🔔" title="Notification Settings" sub="Alerts, reminders, unusual activity"
          color="#F9A825" open={open.notif} onPress={()=>tog('notif')}/>
        {open.notif&&(
          <Body>
            <ToggleRow icon="📋" label="Missing Report Alert" sub="Notify when daily report not submitted by 23:00" value={notifMissing} onChange={setNotifMissing}/>
            <ToggleRow icon="📦" label="SPEC Order Reminder" sub="Remind managers to submit SPEC by 18:00" value={notifSpec} onChange={setNotifSpec}/>
            <ToggleRow icon="💸" label="Cash Flow Reminder" sub="Alert when CF not submitted with daily report" value={notifCF} onChange={setNotifCF}/>
            <ToggleRow icon="⚠️" label="Unusual Expense Alert" sub="Flag when expenses exceed threshold" value={notifExpense} onChange={setNotifExpense}/>
            <ActBtn icon="📨" label="Send Test Notification" sub="Send a test push to this device"
              color="#F9A825" bg="#FFFDE7" onPress={()=>soon('Test Notification')}/>
          </Body>
        )}

        {/* ── 5. FINANCIAL SETTINGS ────────────────────────── */}
        <SH icon="💰" title="Financial Settings" sub="Labor rate, tax, delivery %, currency"
          color="#1B5E20" open={open.financial} onPress={()=>tog('financial')}/>
        {open.financial&&(
          <Body>
            <SettingRow label="Estimated Labor Rate" sub="Used for PLN/hr calculations in analytics" value={`${laborRate} PLN/hr`} onPress={()=>soon('Labor Rate')} type="nav"/>
            <SettingRow label="Tax Rate" sub="VAT / applicable tax percentage" value={`${taxPct}%`} onPress={()=>soon('Tax Rate')} type="nav"/>
            <SettingRow label="Delivery Commission %" sub="Platform fee deducted from delivery revenue" value={`${deliveryPct}%`} onPress={()=>soon('Delivery %')} type="nav"/>
            <SettingRow label="Currency" sub="Display currency across all reports" value="PLN" onPress={()=>soon('Currency')} type="nav"/>
            <SettingRow label="Expense Categories" sub="Manage CF expense category names" value="" onPress={()=>soon('Expense Categories')} type="nav"/>
            <View style={s.infoNote}>
              <Text style={s.infoNoteTxt}>💡 Current defaults: Labor 22 PLN/hr · VAT 23% · Delivery 8% · Currency PLN</Text>
            </View>
          </Body>
        )}

        {/* ── 6. ANALYTICS SETTINGS ────────────────────────── */}
        <SH icon="📊" title="Analytics Settings" sub="Scoring thresholds, warning levels, ranking formula"
          color="#1565C0" open={open.analytics} onPress={()=>tog('analytics')}/>
        {open.analytics&&(
          <Body>
            <Text style={s.permNote}>Thresholds control when ⚠️ warnings appear in Performance and Dashboard tabs.</Text>
            <SettingRow label="Food Cost Warning" sub="Flag when SPEC cost exceeds % of revenue" value={`>${foodWarn}%`} onPress={()=>soon('Food Cost Threshold')} type="nav"/>
            <SettingRow label="Labor Cost Warning" sub="Flag when labor exceeds % of revenue" value={`>${laborWarn}%`} onPress={()=>soon('Labor Threshold')} type="nav"/>
            <SettingRow label="Profit Margin Warning" sub="Alert when estimated profit margin drops below %" value={`<${profitWarn}%`} onPress={()=>soon('Profit Threshold')} type="nav"/>
            <SettingRow label="Report Discipline Warning" sub="Flag when branch submits fewer than N reports/month" value="<20/mo" onPress={()=>soon('Report Threshold')} type="nav"/>
            <SettingRow label="Performance Scoring Formula" sub="Adjust weights: Revenue/Labor/SPEC/Reports/Expenses" value="" onPress={()=>soon('Scoring Formula')} type="nav"/>
            <View style={s.infoNote}>
              <Text style={s.infoNoteTxt}>Current scoring: Revenue 30% · Labor 25% · SPEC 20% · Reports 15% · Expenses 10%</Text>
            </View>
          </Body>
        )}

        {/* ── 7. APP SETTINGS ──────────────────────────────── */}
        <SH icon="🌍" title="App Settings" sub="Language, theme, timezone, refresh interval"
          color="#00695C" open={open.app} onPress={()=>tog('app')}/>
        {open.app&&(
          <Body>
            <ToggleRow icon="🌙" label="Dark Mode" sub="Switch to dark theme (coming soon)" value={darkMode} onChange={v=>{setDarkMode(v);soon('Dark Mode');}}/>
            <SettingRow label="Language" sub="App display language" value="English" onPress={()=>soon('Language')} type="nav"/>
            <SettingRow label="Timezone" sub="Used for report date grouping" value="Europe/Warsaw" onPress={()=>soon('Timezone')} type="nav"/>
            <SettingRow label="Default View" sub="Opening tab when app launches" value="Dashboard" onPress={()=>soon('Default Tab')} type="nav"/>
            <SettingRow label="Auto-Refresh Interval" sub="How often data syncs in background" value="5 min" onPress={()=>soon('Refresh Interval')} type="nav"/>
          </Body>
        )}

        {/* ── 8. DATABASE / SUPABASE ───────────────────────── */}
        <SH icon="☁️" title="Database & Supabase" sub="Connection, sync, backup, cache"
          color="#0277BD" open={open.db} onPress={()=>tog('db')}/>
        {open.db&&(
          <Body>
            <View style={[s.dbStatusCard,{borderColor:dbStatus==='connected'?COLORS.primary:dbStatus==='error'?COLORS.danger:'#ddd'}]}>
              <View style={[s.dbDot,{backgroundColor:dbStatus==='connected'?COLORS.primary:dbStatus==='error'?COLORS.danger:'#ccc'}]}/>
              <View style={{flex:1}}>
                <Text style={s.dbStatusTxt}>
                  {dbStatus==='connected'?'Connected':'dbStatus'==='error'?'Connection Error':'Status Unknown'}
                </Text>
                <Text style={s.dbStatusSub}>Last checked: {timeAgo(lastSync)}</Text>
              </View>
              {syncing&&<ActivityIndicator size="small" color={COLORS.primary}/>}
            </View>
            <ActBtn icon="🔌" label="Test Connection" sub="Ping Supabase to verify availability"
              color="#0277BD" bg="#E1F5FE" onPress={testConnection}/>
            <ActBtn icon="🔄" label="Force Sync" sub="Pull latest data from all tables"
              color="#0277BD" bg="#E1F5FE" onPress={()=>{ testConnection(); }}/>
            <ActBtn icon="🗑️" label="Clear App Cache" sub="Reset cached queries and temporary data"
              color="#D32F2F" bg="#FFEBEE" onPress={()=>Alert.alert('Clear Cache','This will clear locally cached data. You will need to reload all screens.',[{text:'Cancel',style:'cancel'},{text:'Clear',style:'destructive',onPress:()=>soon('Clear Cache')}])}/>
            <ActBtn icon="📐" label="Rebuild Analytics" sub="Recalculate all performance scores"
              color="#0277BD" bg="#E1F5FE" onPress={()=>soon('Rebuild Analytics')}/>
            <ActBtn icon="💾" label="Backup Database" sub="Export full Supabase snapshot"
              color="#0277BD" bg="#E1F5FE" onPress={()=>soon('Backup')}/>
          </Body>
        )}

        {/* ── 9. SECURITY ──────────────────────────────────── */}
        <SH icon="🔐" title="Security" sub="Owner PIN, session timeout, login history"
          color="#880E4F" open={open.security} onPress={()=>tog('security')}/>
        {open.security&&(
          <Body>
            <ActBtn icon="🔑" label="Change Owner PIN" sub="Update the owner master access code (9999)"
              color="#880E4F" bg="#FCE4EC" onPress={()=>soon('Change Owner PIN')}/>
            <ActBtn icon="⏱️" label="Session Timeout" sub="Auto log out after inactivity (current: 30 min)"
              color="#880E4F" bg="#FCE4EC" onPress={()=>soon('Session Timeout')}/>
            <ActBtn icon="📋" label="Login History" sub="See recent logins by branch and owner"
              color="#880E4F" bg="#FCE4EC" onPress={()=>soon('Login History')}/>
            <ActBtn icon="📱" label="Device Management" sub="Manage trusted devices for the app"
              color="#880E4F" bg="#FCE4EC" onPress={()=>soon('Devices')}/>
            <View style={s.infoNote}>
              <Text style={s.infoNoteTxt}>🔒 Owner PIN: 9999 · Managers use branch PINs 1001–1010</Text>
            </View>
          </Body>
        )}

        {/* ── 10. SYSTEM INFO ──────────────────────────────── */}
        <SH icon="📱" title="System Info" sub="Version, build, Supabase status"
          color="#37474F" open={open.sysinfo} onPress={()=>tog('sysinfo')}/>
        {open.sysinfo&&(
          <Body>
            {[
              ['App Name',       'Dostana Mobile'],
              ['Version',        '1.0.0'],
              ['Build',          '100'],
              ['Platform',       'Expo SDK 54'],
              ['React Native',   '0.81.5'],
              ['Backend',        'Supabase'],
              ['Branches',       String(BRANCHES.length)],
              ['Environment',    'Production'],
              ['Last Sync',      timeAgo(lastSync)],
              ['DB Status',      dbStatus==='connected'?'✅ Connected':dbStatus==='error'?'❌ Error':'⚪ Unknown'],
            ].map(([k,v])=>(
              <View key={k} style={s.infoRow}>
                <Text style={s.infoKey}>{k}</Text>
                <Text style={s.infoVal}>{v}</Text>
              </View>
            ))}
          </Body>
        )}

        {/* Log out */}
        <TouchableOpacity style={s.logoutFull} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={s.logoutFullTxt}>🚪  Log Out from Owner Account</Text>
        </TouchableOpacity>

        <Text style={s.footer}>Dostana Kebab · v1.0.0 · Supabase Backend</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ───────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:         { flex:1, backgroundColor:'#F4F6F8' },
  pageHeader:   { backgroundColor:COLORS.primary, paddingHorizontal:20, paddingTop:16, paddingBottom:18, flexDirection:'row', alignItems:'center' },
  pageTitle:    { fontSize:20, fontWeight:'800', color:'#fff' },
  pageSub:      { fontSize:11, color:'rgba(255,255,255,0.8)', marginTop:2 },
  logoutBtn:    { backgroundColor:'rgba(255,255,255,0.2)', borderRadius:8, paddingHorizontal:12, paddingVertical:7 },
  logoutTxt:    { color:'#fff', fontWeight:'700', fontSize:12 },
  content:      { padding:14, paddingBottom:50, gap:6 },
  sectionBody:  { backgroundColor:'#fff', borderRadius:14, padding:14, marginBottom:6, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:3, elevation:1 },
  divider:      { height:1, backgroundColor:'#F0F0F0', marginVertical:12 },
  subheading:   { fontSize:12, fontWeight:'800', color:'#aaa', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 },
  branchRow:    { flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5', gap:10 },
  branchName:   { fontSize:13, fontWeight:'700', color:'#222' },
  branchSub:    { fontSize:11, color:'#aaa', marginTop:1 },
  editChip:     { fontSize:11, color:COLORS.primary, fontWeight:'700' },
  dot:          { width:8, height:8, borderRadius:4 },
  mgrCard:      { backgroundColor:'#F8FAFB', borderRadius:10, padding:12, marginBottom:8, borderWidth:1, borderColor:'#EEE' },
  mgrName:      { flex:1, fontSize:13, fontWeight:'800', color:'#222' },
  mgrSub:       { fontSize:11, color:'#aaa' },
  pinResetBtn:  { backgroundColor:'#FFF3E0', borderRadius:6, paddingHorizontal:10, paddingVertical:5 },
  pinResetTxt:  { fontSize:11, fontWeight:'700', color:'#E65100' },
  permLabel:    { fontSize:11, fontWeight:'700', color:'#aaa', textTransform:'uppercase', marginTop:4 },
  permNote:     { fontSize:12, color:'#888', lineHeight:18, backgroundColor:'#F5F5F5', borderRadius:8, padding:10, marginBottom:10 },
  catLabel:     { fontSize:12, fontWeight:'800', textTransform:'uppercase', letterSpacing:0.5, marginTop:10, marginBottom:4 },
  productRow:   { flexDirection:'row', alignItems:'center', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#F8F8F8', gap:8 },
  productName:  { flex:1, fontSize:13, fontWeight:'700', color:'#222' },
  productUnit:  { fontSize:11, color:'#aaa', width:50 },
  productPrice: { fontSize:11, color:'#888', width:90, textAlign:'right' },
  editSmall:    { fontSize:11, color:COLORS.primary, fontWeight:'700', marginLeft:6 },
  infoNote:     { marginTop:10, backgroundColor:'#F0F7FF', borderRadius:8, padding:10 },
  infoNoteTxt:  { fontSize:11, color:'#555', lineHeight:18 },
  dbStatusCard: { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderRadius:12, padding:12, marginBottom:10, gap:10 },
  dbDot:        { width:10, height:10, borderRadius:5 },
  dbStatusTxt:  { fontSize:13, fontWeight:'700', color:'#222' },
  dbStatusSub:  { fontSize:11, color:'#aaa', marginTop:1 },
  infoRow:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  infoKey:      { fontSize:13, fontWeight:'600', color:'#555' },
  infoVal:      { fontSize:13, color:'#aaa' },
  logoutFull:   { backgroundColor:'#D32F2F', borderRadius:14, paddingVertical:16, alignItems:'center', marginTop:8 },
  logoutFullTxt:{ color:'#fff', fontWeight:'800', fontSize:15 },
  footer:       { textAlign:'center', color:'#bbb', fontSize:11, marginTop:4 },
  wBranchChip:       { borderRadius:20, borderWidth:1.5, borderColor:'#DDD', backgroundColor:'#fff', paddingHorizontal:13, paddingVertical:7 },
  wBranchChipActive: { backgroundColor:'#1565C0', borderColor:'#1565C0' },
  wBranchChipTxt:    { fontSize:12, fontWeight:'700', color:'#555' },
  wAddRow:           { flexDirection:'row', gap:8, marginBottom:4 },
  wNameInput:        { flex:1, borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:10, paddingHorizontal:12, paddingVertical:9, fontSize:13, color:'#111', backgroundColor:'#FAFAFA' },
  wAddBtn:           { backgroundColor:'#1565C0', borderRadius:10, paddingHorizontal:16, paddingVertical:9, justifyContent:'center' },
  wAddBtnTxt:        { color:'#fff', fontWeight:'800', fontSize:13 },
  wRow:              { flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5', gap:10 },
  wName:             { flex:1, fontSize:13, fontWeight:'700', color:'#222' },
  wToggleBtn:        { paddingHorizontal:8, paddingVertical:4, borderRadius:6, backgroundColor:'#F5F5F5' },
  wToggleTxt:        { fontSize:11, fontWeight:'700' },
  wDelBtn:           { paddingHorizontal:4 },
  wEmpty:            { fontSize:13, color:'#aaa', textAlign:'center', paddingVertical:16 },
});
