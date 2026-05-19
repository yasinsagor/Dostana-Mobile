import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, BRANCHES } from '../../constants';

export default function OwnerSettingsScreen() {
  const { logout } = useAuth();

  const handleLogout = () =>
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);

  const infoRows = [
    ['App Name',    'Dostana Mobile'],
    ['Version',     '1.0.0'],
    ['Backend',     'Supabase'],
    ['Branches',    String(BRANCHES.length)],
    ['Environment', 'Production'],
    ['Owner PIN',   '9999'],
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>

        {/* Profile card */}
        <View style={s.profile}>
          <View style={s.crown}><Text style={{fontSize:30}}>👑</Text></View>
          <View style={{flex:1}}>
            <Text style={s.profileName}>Owner</Text>
            <Text style={s.profileSub}>Full access · {BRANCHES.length} branches · Dostana Kebab</Text>
          </View>
        </View>

        {/* Log out button */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={s.logoutTxt}>🚪  Log Out</Text>
        </TouchableOpacity>

        {/* App info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📱 App Information</Text>
          {infoRows.map(([k,v])=>(
            <View key={k} style={s.infoRow}>
              <Text style={s.infoKey}>{k}</Text>
              <Text style={s.infoVal}>{v}</Text>
            </View>
          ))}
        </View>

        {/* Tip card */}
        <View style={s.tipCard}>
          <Text style={s.tipTitle}>💡 Quick Tip</Text>
          <Text style={s.tipText}>Use the 🛠 Operations tab for reports, supplier tools, branch management, exports, and the audit log.</Text>
        </View>

        <Text style={s.footer}>Dostana Kebab Management · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F4F6F8'},
  content:{padding:20,gap:14,paddingBottom:60},
  profile:{flexDirection:'row',alignItems:'center',backgroundColor:COLORS.primary,borderRadius:18,padding:20,gap:16},
  crown:{width:60,height:60,borderRadius:30,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  profileName:{fontSize:20,fontWeight:'800',color:'#fff'},
  profileSub:{fontSize:12,color:'rgba(255,255,255,0.8)',marginTop:3},
  logoutBtn:{backgroundColor:'#D32F2F',borderRadius:14,paddingVertical:16,alignItems:'center'},
  logoutTxt:{color:'#fff',fontWeight:'800',fontSize:15,letterSpacing:0.3},
  card:{backgroundColor:'#fff',borderRadius:16,padding:18,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:4,elevation:2},
  cardTitle:{fontSize:14,fontWeight:'800',color:'#333',marginBottom:12},
  infoRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:11,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  infoKey:{fontSize:13,color:'#555',fontWeight:'600'},
  infoVal:{fontSize:13,color:'#aaa'},
  tipCard:{backgroundColor:'#FFF8E1',borderRadius:14,padding:16,borderLeftWidth:4,borderLeftColor:'#FBC02D'},
  tipTitle:{fontSize:13,fontWeight:'800',color:'#F9A825',marginBottom:6},
  tipText:{fontSize:13,color:'#555',lineHeight:20},
  footer:{textAlign:'center',color:'#bbb',fontSize:11,marginTop:4},
});
