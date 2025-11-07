#include<iostream>
#include<vector>
#include<deque>
#include<string>
#include<map>

using namespace std;

//个位0~12对应的火星数字
const vector<string> eartab_low = {"tret","jan","feb","mar","apr","may","jun","jly","aug","sep","oct","nov","dec"};
//高位1~12对应的火星数字
const vector<string> eartab_high = {"tam","hel","maa","huh","tou","kes","hei","elo","syy","lok","mer","jou"};

//火星数字转换为地球数字
const map<string,int> martab_high = {
    {"tam",1},
    {"hel",2},
    {"maa",3},
    {"huh",4},
    {"tou",5},
    {"kes",6},
    {"hei",7},
    {"elo",8},
    {"syy",9},
    {"lok",10},
    {"mer",11},
    {"jou",12}
};
const map<string,int> martab_low = {
    {"tret",0},
    {"jan",1},
    {"feb",2},
    {"mar",3},
    {"apr",4},
    {"may",5},
    {"jun",6},
    {"jly",7},
    {"aug",8},
    {"sep",9},
    {"oct",10},
    {"nov",11},
    {"dec",12}
};

//10的exp次方
int func(int& exp){
    
    if(exp == 0){
        return 1;
    }
    
    int res = 1;
    for(int i=0;i<exp;i++){
        res *= 10;
    }
    return res;
}

//字符串转换成数字
int tonum(string& str){
    int len = str.length();
    int res = 0;
    for(int i=0;i<len;i++){
        int exp = len - i - 1;
        res += (str[i] - '0')*func(exp);
    }
    return res;
}

//地球数字转换成火星数字
string earth_to_mar(string& earthnum){
    int len = earthnum.length();
    int num = tonum(earthnum);
    string res = "";
    if(num < 13){
        return eartab_low[num];
    }
    else{
        while(num > 0){
            int temp = num % 13;
            if(num > 12){
                res += eartab_high[temp];
            }
            else{
                res += eartab_low[temp];
            }
            num /= 13;
        }
    }
    return res;
}

//火星数字转换成地球数字
int mar_to_earth(string& marnum){
    string high = "";
    string low = "";
    int len = marnum.length();
    int spaceindex = 0;
    for(int i=0;i<len;i++){
        if(marnum[i] = ' '){
            spaceindex = i;
            break;
        }
    }
    if(spaceindex == 0){
        for(int i=0;i<len;i++){
            low += marnum[i];
        }
        if(low == "tam"){
            return 13;
        }
        else{
            return martab_low.at(low);
        }
    }
    for(int i=0;i<=spaceindex;i++){
        high += marnum[i];
    }
    for(int i=spaceindex+1;i<len;i++){
        low += marnum[i];
    }
    return martab_high.at(high)*13 + martab_low.at(low);
}
int main(){
    int n;
    cin >> n;
    vector<string> nums(n);
    vector<string> res(n);
    for(int i=0;i<n;i++){
        getline(cin,nums[i]);
        if(nums[i][0] > 57){
            res[i] = mar_to_earth(nums[i]);
        }
        else{
            res[i] = earth_to_mar(nums[i]);
        }
    }
    for(int i=0;i<n;i++){
        cout << res[i] << endl;
    }
    return 0;
}